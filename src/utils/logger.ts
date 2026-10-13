type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  taskId?: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 200;

  private formatMessage(level: LogLevel, message: string, taskId?: string): string {
    const prefix = `[${new Date().toISOString().substring(11, 19)}] [AI-Assistant]${taskId ? ` [Task:${taskId.substring(0, 6)}]` : ''}`;
    return `${prefix} [${level.toUpperCase()}]: ${message}`;
  }

  private sanitize(data: any): any {
    if (!data) return data;
    try {
      const str = JSON.stringify(data);
      // Mask password/token fields
      return JSON.parse(
        str.replace(/"(password|token|secret|apiKey|auth)":\s*"[^"]+"/gi, '"$1": "***"')
      );
    } catch {
      return data;
    }
  }

  public log(level: LogLevel, message: string, data?: any, taskId?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      taskId,
      data: this.sanitize(data),
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const formatted = this.formatMessage(level, message, taskId);
    switch (level) {
      case 'debug':
        console.debug(formatted, data ? this.sanitize(data) : '');
        break;
      case 'info':
        console.log(formatted, data ? this.sanitize(data) : '');
        break;
      case 'warn':
        console.warn(formatted, data ? this.sanitize(data) : '');
        break;
      case 'error':
        console.error(formatted, data ? this.sanitize(data) : '');
        break;
    }
  }

  public debug(message: string, data?: any, taskId?: string): void {
    this.log('debug', message, data, taskId);
  }

  public info(message: string, data?: any, taskId?: string): void {
    this.log('info', message, data, taskId);
  }

  public warn(message: string, data?: any, taskId?: string): void {
    this.log('warn', message, data, taskId);
  }

  public error(message: string, data?: any, taskId?: string): void {
    this.log('error', message, data, taskId);
  }

  public getRecentLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }
}

export const logger = new Logger();
