const pool = require("./db");

// Fetch all contacts matching email or phone, then union all related families
async function findMatchingContacts(email, phoneNumber) {
    const client = await pool.connect();
    try {
        // Initial match: contacts that match email or phone
        const { rows: initialMatches } = await client.query(
            `
            SELECT * FROM contacts 
            WHERE 
                (email = $1 AND $1 IS NOT NULL) 
                OR 
                (phone_number = $2 AND $2 IS NOT NULL)
            `,
            [email, phoneNumber]
        );

        if (initialMatches.length === 0) return [];

        // Build a set of unique root IDs from the initial matches.
        // For a primary, its own id is used; for a secondary, use its linked_id.
        const rootIdsSet = new Set();
        for (const contact of initialMatches) {
            const rootId = (contact.link_precedence === "primary" ? contact.id : contact.linked_id);
            if (rootId) {
                rootIdsSet.add(rootId);
            }
        }

        // For each root id, fetch the entire family (the primary and any linked secondaries)
        const allFamily = [];
        for (const rootId of rootIdsSet) {
            const { rows: family } = await client.query(
                `
                SELECT * FROM contacts 
                WHERE id = $1 OR linked_id = $1
                `,
                [rootId]
            );
            // add contacts if not already present (union)
            family.forEach(contact => {
                if (!allFamily.some(c => c.id === contact.id)) {
                    allFamily.push(contact);
                }
            });
        }

        return allFamily;
    } finally {
        client.release();
    }
}

async function insertPrimaryContact(email, phoneNumber, state, linked) {
    const client = await pool.connect();
    try {
        const { rows } = await client.query(
            `
            INSERT INTO contacts (email, phone_number, linked_id, link_precedence)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `,
            [email, phoneNumber, linked, state]
        );
        return rows[0];
    } finally {
        client.release();
    }
}

// Downgrade a contact to secondary with new linked_id and update its updated_at timestamp.
async function downgradeToSecondary(contactId, newLinkedId) {
    const client = await pool.connect();
    try {
        await client.query(
            `
            UPDATE contacts
            SET link_precedence = 'secondary',
                linked_id = $2,
                updated_at = NOW()
            WHERE id = $1
            `,
            [contactId, newLinkedId]
        );
    } finally {
        client.release();
    }
}

module.exports = {
    findMatchingContacts,
    insertPrimaryContact,
    downgradeToSecondary,
};
