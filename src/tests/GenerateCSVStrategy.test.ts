import { GenerateCSVToshlStrategy } from '../GenerateCSVToshlStrategy';

describe('GenerateCSVStrategy', () => {
  let generateCSVStrategy: GenerateCSVToshlStrategy;

  beforeEach(() => {
    generateCSVStrategy = new GenerateCSVToshlStrategy('test.csv');
  });

  describe('formatDate', () => {
    it('should format "13 januari 2024" to "2024-01-13"', () => {
      const formattedDate = generateCSVStrategy.formatDate('13 januari 2024');
      expect(formattedDate).toBe('2024-01-13');
    });

    it('should format "september 22, 2024" to "2024-09-22"', () => {
      const formattedDate = generateCSVStrategy.formatDate('september 22, 2024');
      expect(formattedDate).toBe('2024-09-22');
    });

    it('should return the original string for an invalid date format', () => {
      const formattedDate = generateCSVStrategy.formatDate('invalid date');
      expect(formattedDate).toBe('invalid date');
    });

    it('should return the original string for an unknown month', () => {
      const formattedDate = generateCSVStrategy.formatDate('13 unknown 2024');
      expect(formattedDate).toBe('13 unknown 2024');
    });

    it('should return the current date for a null input', () => {
      const formattedDate = generateCSVStrategy.formatDate(null);
      const currentDate = new Date().toISOString().split('T')[0];
      expect(formattedDate).toBe(currentDate);
    });

    it('should return the current date for an empty string input', () => {
      const formattedDate = generateCSVStrategy.formatDate('');
      const currentDate = new Date().toISOString().split('T')[0];
      expect(formattedDate).toBe(currentDate);
    });
  });
});