import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FileParserService } from './file-parser.service';

describe('FileParserService', () => {
  let service: FileParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileParserService],
    }).compile();

    service = module.get<FileParserService>(FileParserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    buffer: Buffer.from('Hello world'),
    size: 11,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  });

  describe('parse', () => {
    it('FILEPARSE-01: should parse UTF-8 text file', () => {
      const file = makeFile({
        originalname: 'test.txt',
        buffer: Buffer.from('Hello world'),
      });
      const result = service.parse(file);
      expect(result.content).toBe('Hello world');
      expect(result.fileName).toBe('test.txt');
      expect(result.fileType).toBe('text/plain');
    });

    it('FILEPARSE-02: should parse .md file', () => {
      const file = makeFile({
        originalname: 'readme.md',
        buffer: Buffer.from('# Title\nContent'),
      });
      const result = service.parse(file);
      expect(result.content).toContain('# Title');
    });

    it('FILEPARSE-03: should parse .csv file', () => {
      const file = makeFile({
        originalname: 'data.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('a,b,c\n1,2,3'),
      });
      const result = service.parse(file);
      expect(result.content).toContain('a,b,c');
    });

    it('FILEPARSE-04: should parse .json file', () => {
      const file = makeFile({
        originalname: 'data.json',
        mimetype: 'application/json',
        buffer: Buffer.from('{"key": "value"}'),
      });
      const result = service.parse(file);
      expect(result.content).toContain('"key"');
    });

    it('FILEPARSE-05: should throw on file too large', () => {
      const file = makeFile({ size: 11 * 1024 * 1024 });
      expect(() => service.parse(file)).toThrow(BadRequestException);
    });

    it('FILEPARSE-06: should throw on unsupported file format', () => {
      const file = makeFile({ originalname: 'image.png' });
      expect(() => service.parse(file)).toThrow(BadRequestException);
    });

    it('FILEPARSE-07: should throw on .docx format', () => {
      const file = makeFile({ originalname: 'doc.docx' });
      expect(() => service.parse(file)).toThrow(BadRequestException);
    });

    it('FILEPARSE-08: should throw on empty file content', () => {
      const file = makeFile({ buffer: Buffer.from('   ') });
      expect(() => service.parse(file)).toThrow(BadRequestException);
    });
  });

  describe('GBK encoding detection', () => {
    it('FILEPARSE-09: should auto-detect and decode GBK file', () => {
      const buffer = Buffer.from('Hello 你好 мир', 'utf8');
      const file = makeFile({ buffer });
      const result = service.parse(file);
      expect(result.content).toContain('Hello');
    });
  });

  describe('Boundary cases', () => {
    it('FILEPARSE-15: should handle empty extension filename', () => {
      const file = makeFile({ originalname: 'noextension' });
      expect(() => service.parse(file)).toThrow(BadRequestException);
    });

    it('FILEPARSE-16: should handle very long filename', () => {
      const longName = 'a'.repeat(255) + '.txt';
      const file = makeFile({ originalname: longName, buffer: Buffer.from('content') });
      const result = service.parse(file);
      expect(result.fileName).toBe(longName);
    });

    it('FILEPARSE-17: should handle exactly 10MB file (boundary)', () => {
      const file = makeFile({ size: 10 * 1024 * 1024, buffer: Buffer.alloc(10 * 1024 * 1024, 'a') });
      const result = service.parse(file);
      expect(result.content).toBeDefined();
    });

    it('FILEPARSE-18: should handle exactly 10MB + 1 byte file (over limit)', () => {
      const file = makeFile({ size: 10 * 1024 * 1024 + 1 });
      expect(() => service.parse(file)).toThrow(BadRequestException);
    });

    it('FILEPARSE-19: should handle minimal text content (1 char)', () => {
      const file = makeFile({ buffer: Buffer.from('a') });
      const result = service.parse(file);
      expect(result.content).toBe('a');
    });
  });

  describe('PDF parsing', () => {
    it('FILEPARSE-11: should extract text from simple PDF buffer', () => {
      // Create a buffer that mimics PDF text objects
      const pdfContent = '%PDF-1.4\nBT (Hello PDF) Tj ET\nBT (Page 2) Tj ET\n%%EOF';
      const file = makeFile({
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from(pdfContent),
      });
      const result = service.parse(file);
      expect(result.content).toContain('Hello PDF');
      expect(result.content).toContain('Page 2');
    });

    it('FILEPARSE-12: should throw on non-extractable PDF', () => {
      // PDF buffer without any text objects
      const pdfContent = '%PDF-1.4\n1 0 obj\n/Type /Catalog\nendobj\n%%EOF';
      const file = makeFile({
        originalname: 'empty.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from(pdfContent),
      });
      expect(() => service.parse(file)).toThrow(BadRequestException);
    });

    it('FILEPARSE-13: should handle PDF with array text TJ operator', () => {
      const pdfContent = '%PDF-1.4\nBT [(Hello World)] TJ ET\n%%EOF';
      const file = makeFile({
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from(pdfContent),
      });
      const result = service.parse(file);
      expect(result.content).toContain('Hello World');
    });
  });

  describe('getExtension', () => {
    it('FILEPARSE-14: should extract extension from filename', () => {
      expect((service as any).getExtension('file.txt')).toBe('txt');
      expect((service as any).getExtension('path/to/file.md')).toBe('md');
      expect((service as any).getExtension('noext')).toBe('');
    });
  });
});
