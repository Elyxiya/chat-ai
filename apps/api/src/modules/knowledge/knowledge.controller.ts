import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateKbDto, AddDocumentDto, SearchKbDto } from './dto/knowledge.dto';
import { success } from '../common/result';

@ApiTags('Knowledge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'knowledge', version: '1' })
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('bases')
  @ApiOperation({ summary: 'List all knowledge bases' })
  async listBases(@CurrentUser('id') userId: string) {
    return success(await this.knowledgeService.listBases(userId));
  }

  @Post('bases')
  @ApiOperation({ summary: 'Create a new knowledge base' })
  async createBase(@CurrentUser('id') userId: string, @Body() dto: CreateKbDto) {
    return success(await this.knowledgeService.createBase(userId, dto));
  }

  @Get('bases/:kbId')
  @ApiOperation({ summary: 'Get knowledge base details' })
  async getBase(@CurrentUser('id') userId: string, @Param('kbId') kbId: string) {
    return success(await this.knowledgeService.getBase(userId, kbId));
  }

  @Delete('bases/:kbId')
  @ApiOperation({ summary: 'Delete a knowledge base' })
  async deleteBase(@CurrentUser('id') userId: string, @Param('kbId') kbId: string) {
    await this.knowledgeService.deleteBase(userId, kbId);
    return success(null, 'Knowledge base deleted');
  }

  @Post('bases/:kbId/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document to knowledge base' })
  async uploadDocument(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return success(
      await this.knowledgeService.addDocument(userId, kbId, {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        content: file.buffer.toString('utf-8'),
      }),
    );
  }

  @Post('bases/:kbId/text')
  @ApiOperation({ summary: 'Add text content to knowledge base' })
  async addText(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Body() body: { content: string; metadata?: Record<string, any> },
  ) {
    return success(
      await this.knowledgeService.addTextContent(userId, kbId, body.content, body.metadata),
    );
  }

  @Get('bases/:kbId/documents')
  @ApiOperation({ summary: 'List documents in knowledge base' })
  async listDocuments(@Param('kbId') kbId: string) {
    return success(await this.knowledgeService.listDocuments(kbId));
  }

  @Delete('bases/:kbId/documents/:docId')
  @ApiOperation({ summary: 'Delete a document from knowledge base' })
  async deleteDocument(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('docId') docId: string,
  ) {
    await this.knowledgeService.deleteDocument(userId, kbId, docId);
    return success(null, 'Document deleted');
  }

  @Get('search')
  @ApiOperation({ summary: 'Search across all knowledge bases' })
  async search(
    @CurrentUser('id') userId: string,
    @Query() query: SearchKbDto,
  ) {
    return success(await this.knowledgeService.search(userId, query.query, query.topK));
  }
}
