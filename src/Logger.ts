import fs from 'fs';
import path from 'path';

export class Logger {
  private logDirectory: string;
  
  constructor(logDirectory: string = 'logs') {
    this.logDirectory = logDirectory;
    this.ensureLogDirectoryExists();
  }
  
  private ensureLogDirectoryExists(): void {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }
  
  public logError(context: string, error: any, additionalData?: any): void {
    const timestamp = new Date().toISOString();
    const filename = `${timestamp.replace(/[:.]/g, '_')}_${context.replace(/[^a-zA-Z0-9]/g, '_')}.log`;
    const filePath = path.join(this.logDirectory, filename);
    
    let content = `[${timestamp}] ERROR in ${context}\n`;
    content += `Error: ${error?.message || error}\n`;
    if (error?.stack) {
      content += `Stack: ${error.stack}\n`;
    }
    
    if (additionalData) {
      content += `\nAdditional Data:\n${JSON.stringify(additionalData, null, 2)}\n`;
    }
    
    fs.writeFileSync(filePath, content);
    console.error(`Error logged to ${filePath}`);
  }
}

// Create a singleton instance
export const logger = new Logger();