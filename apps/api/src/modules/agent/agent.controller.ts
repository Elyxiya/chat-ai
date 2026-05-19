import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { AgentOrchestrator } from './orchestrator/agent-orchestrator.service';
import { MemoryService } from './memory/memory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { success } from '../common/result';
import { ChatService } from '../chat/chat.service';

@ApiTags('Agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'agent', version: '1' })
export class AgentController {
  constructor(
    private readonly agentOrchestrator: AgentOrchestrator,
    private readonly memory: MemoryService,
    private readonly chatService: ChatService,
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI Agent' })
  async chat(
    @CurrentUser('id') userId: string,
    @Body() body: { message: string; sessionId?: string; mode?: string },
  ) {
    const response = await this.agentOrchestrator.process(
      userId,
      body.message,
      body.sessionId,
    );
    return success(response);
  }

  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  @ApiProduces('text/event-stream')
  @ApiOperation({ summary: 'Stream AI Agent response (SSE)' })
  async chatStream(
    @CurrentUser('id') userId: string,
    @Body() body: { message: string; sessionId?: string },
    @Res() res: Response,
  ) {
    const timeoutMs = Number(process.env.AI_STREAM_TIMEOUT) || 120000;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`data: ${JSON.stringify({ type: 'start', sessionId: body.sessionId })}\n\n`);

    try {
      const stream = this.agentOrchestrator.streamProcess(
        userId,
        body.message,
        body.sessionId,
      );

      const timeoutSignal = AbortSignal.timeout(timeoutMs);

      timeoutSignal.addEventListener('abort', () => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream timed out' })}\n\n`);
        res.end();
      });

      for await (const chunk of stream) {
        if (timeoutSignal.aborted) break;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }

      if (!timeoutSignal.aborted) {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      }
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    }

    res.end();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get agent conversation history' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    // #region debug log
    fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'C',location:'agent.controller.ts:96',message:'getHistory handler called',data:{userId,limit,typeofLimit:typeof limit},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const history = await this.agentOrchestrator.getConversationHistory(userId, limit);
    // #region debug log
    fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'C',location:'agent.controller.ts:103',message:'getHistory returning success()',data:{userId,historyLength:history?.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return success(history);
  }

  @Delete('memory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear agent short-term memory' })
  async clearMemory(@CurrentUser('id') userId: string) {
    await this.agentOrchestrator.clearMemory(userId);
    return success(null, 'Memory cleared');
  }

  @Post('memory/summarize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Summarize and compress conversation memory' })
  async summarizeMemory(@CurrentUser('id') userId: string) {
    await this.memory.summarizeAndCompress(userId);
    return success(null, 'Memory summarized');
  }

  @Get('status')
  @ApiOperation({ summary: 'Get AI service status' })
  async getStatus() {
    return success({
      online: true,
      model_v3: 'deepseek-chat',
      model_r1: 'deepseek-reasoner',
      timestamp: new Date().toISOString(),
    });
  }
}
