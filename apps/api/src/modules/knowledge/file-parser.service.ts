import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as iconv from 'iconv-lite';

export interface ParsedFile {
  content: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  // Maximum file size: 10MB
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  constructor() {
    this.logger.log('FileParserService initialized (v2 — GBK auto-detect enabled)');
  }

  parse(file: Express.Multer.File): ParsedFile {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`,
      );
    }

    const ext = this.getExtension(file.originalname);
    const fileName = file.originalname;

    switch (ext) {
      case 'txt':
      case 'md':
      case 'csv':
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
        return this.parseTextFile(file, ext);

      case 'pdf':
        return this.parsePdf(file);

      case 'docx':
        throw new BadRequestException(
          '.docx files are not supported yet. Please convert to .txt or .pdf format.',
        );
      case 'doc':
        throw new BadRequestException(
          '.doc files are not supported. Please convert to .txt or .pdf format.',
        );

      default:
        throw new BadRequestException(
          `Unsupported file format: .${ext}. Supported: .txt, .md, .pdf, .csv, .json`,
        );
    }
  }

  private parseTextFile(file: Express.Multer.File, _ext: string): ParsedFile {
    // Step 1: Always try UTF-8 first
    let content = file.buffer.toString('utf-8');

    // Log a sample for debugging
    const sample = content.substring(0, 120).replace(/\n/g, '\\n');
    this.logger.log(`Parsing "${file.originalname}" (${file.size} bytes). Sample: "${sample}..."`);

    // Step 2: Check for U+FFFD replacement characters (wrong encoding signal)
    if (content.includes('�')) {
      const utf8ReplacementCount = (content.match(/�/g) || []).length;
      this.logger.log(
        `File "${file.originalname}": UTF-8 decoding produced ${utf8ReplacementCount} replacement chars, trying GBK`,
      );

      const gbkContent = iconv.decode(file.buffer, 'gbk');
      const gbkReplacementCount = (gbkContent.match(/�/g) || []).length;

      if (gbkContent && gbkReplacementCount < utf8ReplacementCount) {
        this.logger.log(`File "${file.originalname}" decoded as GBK (${utf8ReplacementCount}→${gbkReplacementCount} replacement chars)`);
        content = gbkContent;
      } else if (utf8ReplacementCount > content.length * 0.5) {
        // More than 50% replacement chars — definitely wrong encoding
        const sample = content.replace(/�/g, '?').substring(0, 80);
        throw new BadRequestException(
          `File encoding not recognized. Please re-save the file as UTF-8 (use "Save with Encoding" in your editor). ` +
          `Sample: "${sample}..."`,
        );
      }
      // else: few replacement chars, keep UTF-8 result
    }

    if (!content || content.trim().length === 0) {
      throw new BadRequestException('File is empty.');
    }

    return {
      content,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
    };
  }

  private parsePdf(file: Express.Multer.File): ParsedFile {
    try {
      const text = this.extractTextFromPdf(file.buffer);

      if (!text || text.trim().length < 10) {
        // PDF appears to be scanned images or encrypted — no extractable text
        throw new BadRequestException(
          'Could not extract text from this PDF. ' +
          'It may be a scanned document (image-based) or encrypted. ' +
          'Please upload a text-based PDF or a .txt file.',
        );
      }

      return {
        content: text,
        fileName: file.originalname,
        fileType: 'application/pdf',
        fileSize: file.size,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`PDF parse failed for ${file.originalname}: ${error.message}`);
      throw new BadRequestException(
        `Failed to parse PDF: ${error.message}. Please upload a .txt file instead.`,
      );
    }
  }

  /**
   * Extract text from a PDF buffer without external dependencies.
   *
   * PDF text objects follow the pattern:
   *   BT (text) Tj ET
   *   BT [(text)] TJ ET
   *
   * This handles simple text-based PDFs. Scanned/image-only PDFs
   * will return empty strings.
   */
  private extractTextFromPdf(buffer: Buffer): string {
    const content = buffer.toString('binary');
    const textParts: string[] = [];

    // Pattern 1: (text) Tj — single text showing operation
    const tjPattern = /\(([^)]*)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjPattern.exec(content)) !== null) {
      textParts.push(this.cleanPdfString(match[1]));
    }

    // Pattern 2: [(text1) (text2)] TJ — array text showing operation
    const tjArrayPattern = /\[([^\]]*)\]\s*TJ/g;
    while ((match = tjArrayPattern.exec(content)) !== null) {
      const innerTexts = match[1].match(/\(([^)]*)\)/g);
      if (innerTexts) {
        const line = innerTexts
          .map((t: string) => this.cleanPdfString(t.slice(1, -1)))
          .join('');
        if (line.trim()) textParts.push(line);
      }
    }

    // Pattern 3: Td/TD positioning — use newline as separator
    const result = textParts
      .join('\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control chars
      .replace(/\n{3,}/g, '\n\n') // Collapse excessive newlines
      .trim();

    return result;
  }

  /**
   * Clean PDF-encoded strings:
   * - Convert octal escapes (\xxx) to characters
   * - Unescape standard escape sequences
   */
  private cleanPdfString(text: string): string {
    return text
      .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
      .replace(/\\(.)/g, '$1')
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .trim();
  }

  private getExtension(filename: string): string {
    const parts = filename.toLowerCase().split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1];
  }
}
