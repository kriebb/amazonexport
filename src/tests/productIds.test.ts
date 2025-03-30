import fs from 'fs';
import path from 'path';
import { ScrapePricesStrategy } from '../ScrapePricesStrategy';
import { PageTracker } from '../PageTracker';

describe('Product IDs', () => {
    let productIds: any[];
    let sut: (itemUri: string | undefined) => (string | null | undefined);
    beforeAll(() => {
        const content = fs.readFileSync('.\\assets\\productIds.json', 'utf-8');
        productIds = JSON.parse(content);
        sut = new ScrapePricesStrategy(new URL('https://example.com'), new PageTracker(true)).extractProductIdFromUrl;
    });

    it('should verify if shipmentProductId is part of shipmentItemUrl and orderItemProductIds', () => {
        const invalidProducts: any[] = [];

        productIds.forEach(product => {
            const shipmentProductId = product.shipmentProductId;
            const shipmentItemUrl = product.shipmentItemUrl;
            const orderItemProductIds: string[] = product.orderItemProductIs;

            const extractedProductIdFromShipmentUrl = sut(`${shipmentItemUrl}`);
            if (extractedProductIdFromShipmentUrl !== shipmentProductId) {
                invalidProducts.push({
                    shipmentProductId,
                    shipmentItemUrl,
                    extractedProductIdFromShipmentUrl,
                    reason: 'Shipment product ID does not match extracted product ID from URL'
                });
            }

            var isFound = orderItemProductIds.find(orderItemProductId => orderItemProductId === shipmentProductId);

            if (!isFound) {
                invalidProducts.push({
                    shipmentProductId,
                    orderItemProductIds,
                    reason: 'Order item product ID does not match shipment product ID'
                });
            }
        });

        if (invalidProducts.length > 0) {
            console.log('Invalid products:', JSON.stringify(invalidProducts, null, 2));
        }

        expect(invalidProducts.length).toBe(0);
    });
});