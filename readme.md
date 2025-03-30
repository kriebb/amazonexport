# Amazon Order Export

This tool scrapes your Amazon order history and exports it to CSV format for use with Toshiba's financial tracking system. It supports multiple Amazon domains (currently Amazon.de and Amazon.be) and allows you to export all orders from a specific year.

## Features

- Scrapes order details from Amazon.de and Amazon.be
- Logs in automatically using your Amazon credentials
- Exports orders to CSV format compatible with Toshl
- Caches order data to avoid unnecessary re-scraping
- Supports headless mode for running without browser UI

## What Problem Does It Solve?

This tool helps you track your Amazon purchases across multiple domains by consolidating them into a single, standardized format that can be imported into financial tracking systems. This is particularly useful if you:

- Need to track business expenses across multiple Amazon domains
- Want to analyze your spending patterns on Amazon
- Need to import Amazon purchases into accounting software

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager
- TypeScript
- create an .env file ( see below)

### Feature Flags Explained ( for the .env file)

- `HEADLESS`: 
  - `true`: Runs the browser in headless mode without a visible UI. Useful for automation and server environments.
  - `false`: Shows the browser UI during operation, helpful for debugging and seeing the scraping process.

- `FORCE_SCRAPE_ORDERS`: 
  - `true`: Forces a new scrape of all order metadata, ignoring any cached data in the JSON files.
  - `false`: Uses cached order data when available, which is faster and reduces Amazon account activity.

- `FORCE_SCRAPE_PRICES`: 
  - `true`: Forces a new scrape of all price information, even if prices are already cached.
  - `false`: Uses cached price data when available, reducing unnecessary requests.

- `SCRAPE_AMAZON_DE` and `SCRAPE_AMAZON_BE`: 
  - `true`: Includes this specific Amazon domain in the scraping process.
  - `false`: Skips this domain entirely.

- `YEAR`: 
  - Sets the target year for order history extraction (e.g., `2024`).
  - The tool will only scrape orders from the specified year.
  - 
### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/amazon-order-export.git
   cd amazon-order-export
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

4. Create a `.env` file in the root directory with the following variables:
   ```
   EMAIL=your_amazon_email@example.com
   PASSWORD=your_amazon_password
   HEADLESS=false
   FORCE_SCRAPE_ORDERS=false
   FORCE_SCRAPE_PRICES=false
   SCRAPE_AMAZON_DE=true
   SCRAPE_AMAZON_BE=true
   YEAR=2024
   ```
 
5. Build the project:
   ```bash
   npm run build
   ```

### Running the Application

Execute the main script:

```bash
node dist/Main.js
```

This will:
1. Log in to your Amazon accounts
2. Scrape your order history for the specified year
3. Generate CSV files in the project root directory:
   - `orders_de.csv` for Amazon Germany orders
   - `orders_be.csv` for Amazon Belgium orders
   - 
### Handling Two-Factor Authentication (2FA)

- Amazon may require a one-time password (OTP) during login
- The script doesn't automatically wait for OTP input
- When running with `HEADLESS=false`:
  1. The login process will pause at the OTP screen
  2. You'll need to manually enter the OTP sent to your device
  3. After successful authentication, the script will continue

For first-time use, it's recommended to:
1. Run with `HEADLESS=false`
2. Be prepared to enter any OTP codes when prompted
3. Wait for the login to complete before the scraping starts

If you frequently need to handle OTP, consider adding a manual wait step to your configuration:
## Configuration Options

- `EMAIL`: Your Amazon account email
- `PASSWORD`: Your Amazon account password
- `HEADLESS`: Set to `true` to run without browser UI, `false` to see the browser automation
- `FORCE_SCRAPE_ORDERS`: Set to `true` to re-scrape order information even if cached
- `FORCE_SCRAPE_PRICES`: Set to `true` to re-scrape price information even if cached
- `SCRAPE_AMAZON_DE`: Set to `true` to include Amazon Germany
- `SCRAPE_AMAZON_BE`: Set to `true` to include Amazon Belgium
- `YEAR`: The year to scrape orders from


## Areas for Improvement

### Code Structure
- Implement better error handling for network issues and Amazon page changes
- Add unit tests for the order scraping functionality
- Refactor the PageTracker class for better separation of concerns

### Features
- Add support for more Amazon domains (e.g., Amazon.com, Amazon.co.uk)
- Implement filtering by order status or date range
- Add a GUI or web interface for easier configuration
- Add support for more export formats (e.g., JSON, PDF)
- Implement multi-account support with separate configuration profiles

### Security
- Store credentials more securely, possibly using keychain or encrypted storage
- Implement session management to avoid frequent logins

## Contributing

Contributions are welcome! Some ideas for contributions:
- Adding support for additional Amazon domains
- Improving the CSV generation for different financial systems
- Adding more robust error handling
- Enhancing the price scraping logic

## License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.