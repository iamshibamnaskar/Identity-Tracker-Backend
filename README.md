# Identity Tracker

a way to identify and keep track of a customer's identity across multiple purchases.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Git](https://git-scm.com/)
- [PostgreSQL](https://www.postgresql.org/) (v14 or higher)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bitspeed.git
cd bitspeed
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory and add your environment variables:
```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/identity_tracker"

# Replace the above with your actual database credentials:

```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

The application will be available at [http://localhost:8000](http://localhost:8000).

