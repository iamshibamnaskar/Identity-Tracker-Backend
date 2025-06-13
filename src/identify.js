const { findMatchingContacts, insertPrimaryContact, downgradeToSecondary } = require("./contactService");
const pool = require("./db");

const identifyHandler = async (req, res) => {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
        return res.status(400).json({ error: "Email or phoneNumber is required" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        console.log("Searching for:", email, phoneNumber);

        // Fetch matching contacts (this now returns union of all related families)
        let matchedContacts = await findMatchingContacts(email, phoneNumber);
        console.log("Matched Contacts:", matchedContacts);

        // See if there is an exact match for both fields (if given)
        const fullyMatchedContact = matchedContacts.find(
            (contact) => contact.email === email && contact.phone_number === phoneNumber
        );

        // Get all contacts with primary status from the union
        const primaryContacts = matchedContacts.filter(
            (contact) => contact.link_precedence === "primary"
        );

        if (fullyMatchedContact) {
            console.log("Fully matched contact found:", fullyMatchedContact);
        } else {
            console.log("No fully matched contact found.");
        }

        // If multiple primaries are present, merge the families:
        if (primaryContacts.length > 1) {
            primaryContacts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            const oldestPrimary = primaryContacts[0];

            for (let i = 1; i < primaryContacts.length; i++) {
                // Demote extra primaries to secondary
                await downgradeToSecondary(primaryContacts[i].id, oldestPrimary.id);
                // Update our in-memory records accordingly
                matchedContacts.forEach((c) => {
                    if (c.id === primaryContacts[i].id) {
                        c.link_precedence = 'secondary';
                        c.linked_id = oldestPrimary.id;
                    }
                });
            }
            // Re-fetch the family from the primary – union all rows with id = oldestPrimary.id or linked_id = oldestPrimary.id.
            const { rows: mergedFamily } = await client.query(
                `
                SELECT * FROM contacts
                WHERE id = $1 OR linked_id = $1
                `,
                [primaryContacts[0].id]
            );
            matchedContacts = mergedFamily;
        }

        // Merge current contacts for response purposes
        const prefinal = await merge(matchedContacts);

        const hasExactMatch = matchedContacts.some(
            c => c.email === email && c.phone_number === phoneNumber
        );

        // If no matching contact for the incoming email/phone, insert a new one.
        // We check using "some" so that even if one field is present among the existing records,
        // we avoid duplicate insert.
        const hasEmailMatch = email && matchedContacts.some(c => c.email === email);
        const hasPhoneMatch = phoneNumber && matchedContacts.some(c => c.phone_number === phoneNumber);

        const isNewEmail = email && !hasEmailMatch;
        const isNewPhone = phoneNumber && !hasPhoneMatch;

        if (!hasExactMatch && (isNewEmail || isNewPhone)) {
            const state = matchedContacts.length === 0 ? "primary" : "secondary";

            // Determine linked: if the new record is secondary, pick the primary.
            let linked = null;
            if (state === "secondary") {
                if (primaryContacts.length > 0) {
                    primaryContacts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                    linked = primaryContacts[0].id;
                } else if (matchedContacts.length > 0) {
                    matchedContacts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                    linked = matchedContacts[0].id;
                }
            }

            const newContact = await insertPrimaryContact(email, phoneNumber, state, linked);
            matchedContacts.push(newContact);
            console.log("Inserted new contact:", newContact);
        }

        const final = await merge(matchedContacts);
        await client.query("COMMIT");
        return res.status(200).json({ contact: final });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Database error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        client.release();
    }
};

const merge = async (contacts) => {
    let emails = [];
    let phones = [];
    let primary = [];
    let secondary = [];

    contacts.forEach(contact => {
        if (contact.email && !emails.includes(contact.email)) {
            emails.push(contact.email);
        }

        if (contact.phone_number && !phones.includes(contact.phone_number)) {
            phones.push(contact.phone_number);
        }

        if (contact.link_precedence === "primary") {
            primary.push(contact.id);
        } else {
            secondary.push(contact.id);
        }
    });

    return {
        primaryContactId: primary.length > 0 ? primary[0] : null,
        emails,
        phoneNumbers: phones,
        secondaryContactIds: secondary
    };
};

module.exports = { identifyHandler };
