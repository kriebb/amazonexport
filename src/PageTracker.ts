import { Browser, BrowserContext, chromium, Page } from "playwright";
import fs from 'fs';
import path from 'path';

export class PageTracker {
    dispose = () => {
        if (this._currentPage) {
            this._currentPage.close();
        }
        if (this._context) {
            this._context.close();
        }
        if (this._browser) {
            this._browser.close();
        }
        this._currentPage = undefined;
        this._context = undefined;
        this._browser = undefined;

        this._isLoggedIn = false;
    }
    private _currentPage: Page | undefined;
    public getCurrentPage = (): Page => {

        if (this._currentPage == undefined)
            throw new Error('Current page is not defined');

        return this._currentPage;
    };
    public _isLoggedIn: boolean = false;
    private _context: BrowserContext | undefined;
    /**
     *
     */
    constructor(private headless: boolean) {


    }
    public appendLogToFile = (logFilePath: string, logContent: string) => {
        fs.appendFileSync(logFilePath, logContent + '\n', 'utf8');
    };

    private _browser: Browser | undefined;
    private logFilePath = path.join(__dirname, 'debug.log');

    public setCurrentPage = async (): Promise<void> => {

        this._browser = await chromium.launch({ headless: this.headless });
        this._context = await this._browser.newContext({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36", recordVideo: { dir: path.join(__dirname, 'videos') } });

        this._currentPage = await this._context.newPage();
    }
    public login = async (email: string, password: string): Promise<void> => {
        console.log('Filling email...');
        await this.getCurrentPage().locator('#ap_email').click();
        await this.getCurrentPage().locator('#ap_email').fill(email);
        await this.getCurrentPage().locator('#ap_email').press('Enter');
        console.log('Filling password...');
        await this.getCurrentPage().locator('#ap_password').click();
        await this.getCurrentPage().locator('#ap_password').fill(password);
        await this.getCurrentPage().locator('#ap_password').press('Enter');

            
    // After submitting password, wait for the orders page to load OR wait for manual 2FA completion
    console.log('Login submitted. If 2FA is required, please complete it in the browser window.');
    console.log('Waiting for successful navigation to the orders page...');
    
    // Wait for the orders page or content to be visible
    await this.getCurrentPage().waitForSelector('.a-pagination, .order-card', {
        timeout: 300000, // 5 minutes for the user to complete any MFA if needed
        state: 'attached'
    });

        this._isLoggedIn = true;
    }

    public createInitialPage = async (url: URL): Promise<void> => {
        if (this._currentPage == undefined)
            await this.setCurrentPage();

        this.getCurrentPage().on('console', msg => {
            if (msg.text() != "Failed to load resource: net::ERR_NAME_NOT_RESOLVED") {
                this.appendLogToFile(this.logFilePath, msg.text());
            }
        });

        console.log('Navigating to Login URL:', url.href);
        await this.getCurrentPage().goto(url.href, { waitUntil: 'domcontentloaded', timeout: 5000 });

    }
}
