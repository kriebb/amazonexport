import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { ScrapePricesStrategy } from '../ScrapePricesStrategy'; // Adjust the import path as necessary
import { OrderDetails } from '../OrderDetails'; // Adjust the import path as necessary
import { PageTracker } from '../PageTracker'; // Adjust the import path as necessary

// Initialize the ScrapePricesStrategy instance with necessary dependencies
const orderItemsTemplateUrl = new URL('http://example.com/order/%%ORDER_NUMBER%%'); // Replace with a valid URL template
const tracker = new PageTracker(false); // Initialize with necessary parameters if required
const scrapePricesStrategy = new ScrapePricesStrategy(orderItemsTemplateUrl, tracker);

describe('extractPriceFromHtml', () => {
    it('should extract the price from the HTML', async () => {
        const content = fs.readFileSync(path.join(__dirname, 'assets', 'datacomponent_unitprice.html'), { encoding: 'utf-8' });
        const dom = new JSDOM(content);

        const priceSelectors = [
            '.a-price-whole',
            '.a-price-fraction',
            '.a-offscreen',
            '.a-color-price',
            '[data-component="unitPrice"] .a-text-price',
            '.yohtmlc-item .a-color-price',
            '.item-price',
            '.a-price .a-offscreen'
        ];

        const price = scrapePricesStrategy.extractPrice(dom.window.document.body, priceSelectors);

        expect(price).toBe('€16,99');
    });
});

describe('allPricesShouldBeSetOnOrder', () => {
    it('should ensure all prices are set on the order', async () => {
        const content = fs.readFileSync(path.join(__dirname, 'assets', 'nopriceset.html'), { encoding: 'utf-8' });
        const shipmentElements = scrapePricesStrategy.extractShipmentElements(content);

        const orderStr = fs.readFileSync(path.join(__dirname, 'assets', 'nopriceset.json'), { encoding: 'utf-8' });
        const order: OrderDetails = JSON.parse(orderStr);

        const returnedItems = await scrapePricesStrategy.processShipmentElements(shipmentElements, order);
        for (const item of returnedItems) {
            expect(item.price).not.toBe(undefined);
        }
    });
});
