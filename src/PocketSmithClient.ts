import axios, { AxiosResponse, AxiosError, AxiosInstance } from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Custom error class for PocketSmith API errors
 */
export class PocketSmithApiError extends Error {
  status: number;
  code: string;
  
  constructor(message: string, status: number, code: string = 'API_ERROR') {
    super(message);
    this.name = 'PocketSmithApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Interface for PocketSmith API authentication and configuration
 */
export interface PocketSmithConfig {
  apiKey: string;
  baseUrl: string;
  accountId: string;
}

/**
 * PocketSmith Transaction Account interface
 */
export interface TransactionAccount {
  id: number;
  name: string;
  description?: string;
  current_balance: number;
  type: "bank" | "credits" | "cash" | "stocks" | "mortgage" | "loans" | "vehicle" | "property" | "insurance" | "other_liability";
  institution_id?: number;
  currency_code?: string;
  account_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * PocketSmith Account interface
 */
export interface Account {
  id: number;
  created_at: string;
  currency_code: string;
  current_balance: number;
  transaction_accounts: TransactionAccount[];
  scenarios: any[];
  institution: {
    id: number;
    title: string;
    created_at: string;
  };
}

/**
 * PocketSmith Transaction interface
 */
export interface Transaction {
  id: number;
  payee: string;
  amount: number;
  date: string;
  category: {
    id: number;
    title: string;
  };
  note?: string;
  transaction_account_id: number;
  labels?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Order Item structure for creating new transactions
 */
export interface OrderItem {
  name: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
}

/**
 * PocketSmith API Client
 */
export class PocketSmithClient {
  private config: PocketSmithConfig;
  private axiosInstance!: AxiosInstance;
  private isInitialized: boolean = false;

  /**
   * Creates a new PocketSmith API client
   * @param config Configuration options, or loads from environment if not provided
   */
  constructor(config?: Partial<PocketSmithConfig>) {
    // Default configuration from environment variables
    this.config = {
      apiKey: process.env.POCKETSMITH_API_KEY || '',
      baseUrl: process.env.POCKETSMITH_BASE_URL || 'https://api.pocketsmith.com/v2',
      accountId: process.env.POCKETSMITH_ACCOUNT_ID || '',
      ...config
    };

    // Validate required config
    if (!this.config.apiKey) {
      console.error('PocketSmith API key is missing. Please set it in your .env file or pass it to the constructor.');
      this.isInitialized = false;
      return;
    }

    // Create Axios instance with default config
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'X-Developer-Key': `${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling with proper types
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status || 500;
          const data = error.response?.data as any;
          const errorMsg = data?.error || error.message || 'Unknown error';
          
          // Format a clean, concise error message
          let message = `PocketSmith API Error (${status}): ${errorMsg}`;
          
          // Add specific handling for common errors
          switch (status) {
            case 401:
              message = "Authentication failed: Invalid or expired API key. Please check your POCKETSMITH_API_KEY in .env file.";
              break;
            case 403:
              message = "Access denied: Your API key doesn't have permission for this operation.";
              break;
            case 404:
              message = "Resource not found: The requested resource doesn't exist. Check your account/transaction IDs.";
              break;
            case 422:
              message = `Validation error: ${errorMsg}`;
              break;
            case 429:
              message = "Rate limit exceeded: You've made too many requests. Please wait before trying again.";
              break;
          }
          
          // Log a simplified error
          console.error(`${message}`);
          
          // Create a custom error with clean information
          const customError = new PocketSmithApiError(
            message,
            status,
            error.code || 'API_ERROR'
          );
          
          return Promise.reject(customError);
        }
        
        console.error('Network or connection error:', error);
        return Promise.reject(error);
      }
    );
    
    this.isInitialized = true;
  }

  /**
   * Validate that the API client can authenticate with PocketSmith
   * @returns True if authentication is successful
   */
  async validateAuthentication(): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('PocketSmith client is not properly initialized.');
      return false;
    }
    
    try {
      console.log('Validating PocketSmith API authentication...');
      await this.axiosInstance.get('/me');
      console.log('✓ Authentication successful. API key is valid.');
      return true;
    } catch (error) {
      if (error instanceof PocketSmithApiError && error.status === 401) {
        console.error('× Authentication failed. Please check your API key.');
      } else {
        console.error('× Error validating authentication:', error instanceof Error ? error.message : String(error));
      }
      return false;
    }
  }

  /**
   * Get the user ID associated with the API key
   * @returns User ID
   */
  async getUserId(): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    try {
      const response = await this.axiosInstance.get('/me');
      return response.data.id;
    } catch (error) {
      // Error is already handled by the interceptor
      throw error;
    }
  }

  /**
   * Get all accounts for the user
   * @returns List of accounts
   */
  async getAllAccounts(): Promise<Account[]> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    try {
      // First, get the user ID
      const userId = await this.getUserId();
      // Then get all accounts for that user
      const response = await this.axiosInstance.get(`/users/${userId}/accounts`);
      return response.data;
    } catch (error) {
      // Error is already handled by the interceptor
      throw error;
    }
  }

  /**
   * Get all transaction accounts across all accounts
   * @returns Flattened list of all transaction accounts
   */
  async getAllTransactionAccounts(): Promise<TransactionAccount[]> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    const accounts = await this.getAllAccounts();
    // Flatten all transaction accounts from all accounts
    return accounts.reduce((all, account) => {
      return [...all, ...account.transaction_accounts];
    }, [] as TransactionAccount[]);
  }

  /**
   * Search for transactions across all transaction accounts
   * @param search Search term
   * @param params Additional search parameters
   * @returns Transactions matching the search criteria with their transaction account information
   */
  async searchAllTransactions(
    search: string,
    params: {
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<{transaction: Transaction, transactionAccount: TransactionAccount}[]> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    const transactionAccounts = await this.getAllTransactionAccounts();
    
    // Search in each transaction account
    const allResults = await Promise.all(
      transactionAccounts.map(async (transactionAccount) => {
        try {
          const transactions = await this.getTransactions(
            transactionAccount.id,
            {
              search,
              start_date: params.start_date,
              end_date: params.end_date
            }
          );
          
          // Map each transaction to include its transaction account
          return transactions.map(transaction => ({
            transaction,
            transactionAccount
          }));
        } catch (error) {
          console.error(`Error searching in account ${transactionAccount.id}:`, 
            error instanceof Error ? error.message : String(error));
          return [];
        }
      })
    );
    
    // Flatten all results
    return allResults.flat();
  }

  /**
   * Find all Amazon transactions across all accounts
   * @param startDate Optional start date for search
   * @returns All Amazon transactions with their transaction account information
   */
  async findAllAmazonTransactions(startDate?: string): Promise<{transaction: Transaction, transactionAccount: TransactionAccount}[]> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    const searchResults = await this.searchAllTransactions('amazon', {
      start_date: startDate
    });
    
    // Filter for actual Amazon transactions
    return searchResults.filter(item => this.isAmazonTransaction(item.transaction));
  }

  /**
   * Get account details from PocketSmith
   * @param accountId Optional account ID, otherwise uses the one from config
   * @returns Account details
   */
  async getAccount(accountId?: string): Promise<Account> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    const id = accountId || this.config.accountId;
    if (!id) {
      throw new Error('Account ID is required. Set it in your .env file or pass it to the method.');
    }
    
    const response = await this.axiosInstance.get<Account>(`/accounts/${id}`);
    return response.data;
  }

  /**
   * Get transactions for an account
   * @param accountId Optional account ID
   * @param params Query parameters for filtering transactions
   * @returns List of transactions
   */
  async getTransactions(
    transactionAccountId: number | string,
    params: {
      start_date?: string;
      end_date?: string;
      search?: string;
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<Transaction[]> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    const response = await this.axiosInstance.get<Transaction[]>(
      `/transaction_accounts/${transactionAccountId}/transactions`,
      { params }
    );
    return response.data;
  }

  /**
   * Delete a transaction by ID
   * @param transactionId Transaction ID to delete
   */
  async deleteTransaction(transactionId: number): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    await this.axiosInstance.delete(`/transactions/${transactionId}`);
  }

  /**
   * Create a new transaction in a transaction account
   * @param transactionAccountId Transaction account ID
   * @param transaction Transaction data
   * @returns Created transaction
   */
  async createTransaction(
    transactionAccountId: number | string,
    transaction: {
      payee: string;
      amount: number;
      date: string;
      category_id?: number;
      note?: string;
      labels?: string[];
    }
  ): Promise<Transaction> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    const response = await this.axiosInstance.post<Transaction>(
      `/transaction_accounts/${transactionAccountId}/transactions`,
      transaction
    );
    return response.data;
  }

  /**
   * Get categories from PocketSmith
   * @returns List of categories
   */
  async getCategories(): Promise<{ id: number; title: string; }[]> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    const response = await this.axiosInstance.get<{ id: number; title: string; }[]>('/categories');
    return response.data;
  }

  /**
   * Find or create a category by name
   * @param categoryName Category name to find or create
   * @returns Category ID
   */
  async findOrCreateCategory(categoryName: string): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    // Get all categories
    const categories = await this.getCategories();
    
    // Find the category by name (case insensitive)
    const existingCategory = categories.find(
      c => c.title.toLowerCase() === categoryName.toLowerCase()
    );
    
    if (existingCategory) {
      return existingCategory.id;
    }
    
    // If not found, create a new category
    try {
      const response = await this.axiosInstance.post<{ id: number; title: string; }>('/categories', {
        title: categoryName,
        color: this.generateCategoryColor(categoryName)
      });
      return response.data.id;
    } catch (error) {
      console.error('Failed to create category:', 
        error instanceof Error ? error.message : String(error));
      // Return a default "Uncategorized" category ID as fallback
      const uncategorized = categories.find(c => c.title.toLowerCase() === 'uncategorized');
      return uncategorized?.id || 0;
    }
  }

  /**
   * Generate a deterministic color based on category name
   * @param categoryName Category name
   * @returns Hex color code
   */
  private generateCategoryColor(categoryName: string): string {
    // Generate a simple hash from the category name
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
      hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert to hex color
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    
    return color;
  }

  /**
   * Identifies if a transaction is from Amazon
   * @param transaction Transaction to check
   * @returns True if it's an Amazon transaction
   */
  isAmazonTransaction(transaction: Transaction): boolean {
    return (
      transaction.payee.toLowerCase().includes('amazon') ||
      (transaction.note?.toLowerCase().includes('amazon') || false)
    );
  }

  /**
   * Split a single Amazon transaction into multiple transactions based on order items
   * @param transaction The Amazon transaction to split
   * @param transactionAccount The transaction account containing the transaction
   * @param orderItems The order items to create as individual transactions
   * @param options Options for processing
   * @returns Result of the split operation
   */
  async splitAmazonTransaction(
    transaction: Transaction,
    transactionAccount: TransactionAccount,
    orderItems: OrderItem[],
    options: {
      dryRun?: boolean;
    } = {}
  ): Promise<{ deleted: number; created: number; }> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    const result = { deleted: 0, created: 0 };
    
    console.log(`Splitting Amazon transaction: ${transaction.payee} (${transaction.amount})`);
    
    // Delete the original transaction if not a dry run
    if (!options.dryRun) {
      await this.deleteTransaction(transaction.id);
      result.deleted = 1;
    } else {
      result.deleted = 1;
      console.log(`Dry run - would delete transaction: ${transaction.id}`);
    }
    
    // Get the transaction account ID
    const transactionAccountId = transactionAccount.id;
    
    // Create new transactions for each order item
    const categoryCache: Record<string, number> = {};
    
    if (!options.dryRun) {
      for (const item of orderItems) {
        // Determine category ID
        let categoryId: number | undefined;
        
        if (item.category) {
          if (!categoryCache[item.category]) {
            categoryCache[item.category] = await this.findOrCreateCategory(item.category);
          }
          categoryId = categoryCache[item.category];
        }
        
        // Create the transaction
        console.log(`Creating transaction: ${item.name} (${item.amount}) in account ${transactionAccountId}`);
        await this.createTransaction(transactionAccountId, {
          payee: `Amazon - ${item.category || 'Shopping'}`,
          amount: -Math.abs(item.amount), // Ensure expense is negative
          date: item.date,
          category_id: categoryId,
          note: item.description,
          labels: ['amazon', 'imported', 'split']
        });
        
        result.created++;
      }
    } else {
      result.created = orderItems.length;
      console.log(`Dry run - would create ${orderItems.length} transactions in account ${transactionAccountId}`);
    }
    
    return result;
  }

  /**
   * Process Amazon order items from CSV data
   * @param orderItems Order items from CSV
   * @param transactionAccountId Transaction account ID to create items in
   * @param options Processing options
   */
  async processAmazonOrderItems(
    orderItems: OrderItem[],
    transactionAccountId: number | string,
    options: {
      deleteExisting?: boolean;
      searchStartDate?: string;
      dryRun?: boolean;
    } = {}
  ): Promise<{ deleted: number; created: number; }> {
    if (!this.isInitialized) {
      throw new Error('PocketSmith client is not properly initialized.');
    }
    
    const result = { deleted: 0, created: 0 };
    
    // Find existing Amazon transactions if deleteExisting is true
    if (options.deleteExisting) {
      const startDate = options.searchStartDate || 
        new Date(Math.min(...orderItems.map(i => new Date(i.date).getTime()))).toISOString().split('T')[0];
      
      console.log(`Finding Amazon transactions since ${startDate}...`);
      
      // Get transactions for the account
      const transactions = await this.getTransactions(transactionAccountId, {
        start_date: startDate,
        search: 'amazon'
      });
      
      console.log(`Found ${transactions.length} potential Amazon transactions`);
      
      // Filter for Amazon transactions
      const amazonTransactions = transactions.filter(t => this.isAmazonTransaction(t));
      console.log(`Identified ${amazonTransactions.length} Amazon transactions`);
      
      // Delete Amazon transactions if not a dry run
      if (!options.dryRun) {
        for (const transaction of amazonTransactions) {
          console.log(`Deleting transaction: ${transaction.payee} (${transaction.amount})`);
          await this.deleteTransaction(transaction.id);
          result.deleted++;
        }
      } else {
        result.deleted = amazonTransactions.length;
        console.log('Dry run - transactions would be deleted:', 
          amazonTransactions.map(t => ({ id: t.id, payee: t.payee, amount: t.amount })));
      }
    }
    
    // Create new transactions for each order item
    const categoryCache: Record<string, number> = {};
    
    if (!options.dryRun) {
      for (const item of orderItems) {
        // Determine category ID
        let categoryId: number | undefined;
        
        if (item.category) {
          if (!categoryCache[item.category]) {
            categoryCache[item.category] = await this.findOrCreateCategory(item.category);
          }
          categoryId = categoryCache[item.category];
        }
        
        // Create the transaction
        console.log(`Creating transaction: ${item.name} (${item.amount})`);
        await this.createTransaction(transactionAccountId, {
          payee: `Amazon - ${item.category || 'Shopping'}`,
          amount: -Math.abs(item.amount), // Ensure expense is negative
          date: item.date,
          category_id: categoryId,
          note: item.description,
          labels: ['amazon', 'imported']
        });
        
        result.created++;
      }
    } else {
      result.created = orderItems.length;
      console.log(`Dry run - would create ${orderItems.length} transactions`);
    }
    
    return result;
  }
}