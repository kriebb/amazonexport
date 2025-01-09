import { ScrapePricesStrategy } from '../ScrapePricesStrategy';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { ElementHandle } from 'playwright';
import { OrderDetails } from '../OrderDetails';

describe('ScrapePricesStrategy', () => {
    let scrapePricesStrategy: ScrapePricesStrategy;

    beforeEach(() => {
        scrapePricesStrategy = new ScrapePricesStrategy(new URL('https://example.com'), { getCurrentPage: () => null } as any);
    });

    describe('extractPriceFromHtml', () => {
        it('should extract the price from the HTML', async () => {
            var content = fs.readFileSync('.\\assets\\datacomponent_unitprice.html', { encoding: 'utf-8' });
            const dom = new JSDOM(content);

            const price = await scrapePricesStrategy.extractPrice(dom.window.document.body);
            expect(price).toBe('€16,99');
        });
    });

    describe('allPricesShouldBeSetOnOrder', () => {
        it('should extract the price from the HTML', async () => {
            var content = fs.readFileSync('.\\assets\\nopriceset.html', { encoding: 'utf-8' });

            const shipmentElements = scrapePricesStrategy.extractShipmentElements(content);


            var orderStr = fs.readFileSync('.\\assets\\nopriceset.json', { encoding: 'utf-8' });
            var order: OrderDetails = JSON.parse(orderStr);

            const returnedItems = await scrapePricesStrategy.processShipmentElements(shipmentElements, order);
            for (var item of returnedItems) {
                expect(item.price).not.toBe(undefined);
            }

        });
    });
});