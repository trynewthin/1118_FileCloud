/**
 * 全局日志服务
 * 
 * 根据环境变量 NODE_ENV 或系统配置控制日志输出粒度：
 * - development: 输出所有级别（debug, info, warn, error）
 * - production: 仅输出 info, warn, error
 * 
 * 日志格式：[时间戳] [级别] [模块名] 消息
 */

// ============================================================================
// 类型定义
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerConfig {
  // 是否为生产模式（生产模式下不输出 debug 日志）
  isProduction: boolean;
  // 是否启用颜色输出
  enableColors: boolean;
  // 是否显示时间戳
  showTimestamp: boolean;
}

// ============================================================================
// 默认配置
// ============================================================================

const defaultConfig: LoggerConfig = {
  isProduction: process.env.NODE_ENV === "production",
  enableColors: true,
  showTimestamp: true,
};

let globalConfig: LoggerConfig = { ...defaultConfig };

// ============================================================================
// 颜色常量（ANSI 转义码）
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  // 级别颜色
  debug: "\x1b[36m",   // 青色
  info: "\x1b[32m",    // 绿色
  warn: "\x1b[33m",    // 黄色
  error: "\x1b[31m",   // 红色
  // 模块名颜色
  module: "\x1b[35m",  // 紫色
};

// ============================================================================
// 日志级别优先级
// ============================================================================

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 生产模式下的最低日志级别
const productionMinLevel: LogLevel = "info";

// ============================================================================
// 核心日志函数
// ============================================================================

const formatTimestamp = (): string => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${ms}`;
};

const formatLevel = (level: LogLevel): string => {
  return level.toUpperCase().padEnd(5);
};

const shouldLog = (level: LogLevel): boolean => {
  if (globalConfig.isProduction) {
    return levelPriority[level] >= levelPriority[productionMinLevel];
  }
  return true;
};

const log = (level: LogLevel, moduleName: string, message: string, ...args: unknown[]): void => {
  if (!shouldLog(level)) return;

  const { enableColors, showTimestamp } = globalConfig;
  
  let output = "";
  
  // 时间戳
  if (showTimestamp) {
    const timestamp = formatTimestamp();
    output += enableColors 
      ? `${colors.dim}${timestamp}${colors.reset} `
      : `${timestamp} `;
  }
  
  // 级别
  const levelStr = formatLevel(level);
  output += enableColors
    ? `${colors[level]}${levelStr}${colors.reset} `
    : `${levelStr} `;
  
  // 模块名
  output += enableColors
    ? `${colors.module}[${moduleName}]${colors.reset} `
    : `[${moduleName}] `;
  
  // 消息
  output += message;
  
  // 输出
  if (level === "error") {
    console.error(output, ...args);
  } else if (level === "warn") {
    console.warn(output, ...args);
  } else {
    console.log(output, ...args);
  }
};

// ============================================================================
// Logger 类（每个模块创建一个实例）
// ============================================================================

export class Logger {
  private moduleName: string;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  debug(message: string, ...args: unknown[]): void {
    log("debug", this.moduleName, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    log("info", this.moduleName, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    log("warn", this.moduleName, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    log("error", this.moduleName, message, ...args);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建一个带有模块名的 Logger 实例
 * @param moduleName 模块名称，会显示在日志中
 */
export const createLogger = (moduleName: string): Logger => {
  return new Logger(moduleName);
};

// ============================================================================
// 配置函数
// ============================================================================

/**
 * 更新日志配置
 */
export const configureLogger = (config: Partial<LoggerConfig>): void => {
  globalConfig = { ...globalConfig, ...config };
};

/**
 * 获取当前日志配置
 */
export const getLoggerConfig = (): LoggerConfig => {
  return { ...globalConfig };
};

/**
 * 设置为生产模式
 */
export const setProductionMode = (isProduction: boolean): void => {
  globalConfig.isProduction = isProduction;
};

// ============================================================================
// 默认导出一个根 Logger（用于系统级日志）
// ============================================================================

export const rootLogger = createLogger("System");
