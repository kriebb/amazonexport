import { PageTracker } from "./PageTracker";

export const getPaginationLinks = async (tracker: PageTracker): Promise<string[]> => {
  console.log('Waiting for order cards...');
  await tracker.getCurrentPage().waitForSelector(' .a-pagination', {
    timeout: 10000, // Wait for a maximum of 10 seconds
  });

  return await tracker.getCurrentPage().evaluate(() => {
    const linkElements = document.querySelectorAll<HTMLAnchorElement>('.a-row .a-pagination .a-normal  :not(.a-selected)');
    console.log('Number of pagination links:', linkElements.length);
    const links = <string[]>[]
    for (const linkElement of linkElements) {
      console.log('Pagination Link:', linkElement.href);
      links.push(linkElement.href);
    }
    return links;
  });
}