/**
 * ConnectionRouter - 连接路由器
 * 支持热切换、读写分离、故障转移
 */

import type { IActionManager } from '../interfaces/IActionManager.js';

/**
 * 数据库节点类型
 */
export type NodeRole = 'master' | 'slave' | 'reader' | 'writer' | 'all';

/**
 * 数据库节点配置
 */
export interface DatabaseNode {
  /** 节点ID */
  id: string;
  /** 节点角色 */
  role: NodeRole;
  /** 权重（用于负载均衡） */
  weight: number;
  /** 是否启用 */
  enabled: boolean;
  /** 健康状态 */
  healthy: boolean;
  /** 最后健康检查时间 */
  lastHealthCheck?: Date;
  /** 连接配置 */
  config: any;
  /** 数据库类型 */
  type: string;
  /** ActionManager 实例 */
  manager?: IActionManager;
}

/**
 * 路由策略
 */
export type RoutingStrategy =
  | 'round-robin'      // 轮询
  | 'random'           // 随机
  | 'weight'           // 权重
  | 'least-connections' // 最少连接
  | 'sticky';          // 粘滞会话

/**
 * 路由配置
 */
export interface RouterConfig {
  /** 读写分离 */
  readWriteSplit: boolean;
  /** 路由策略 */
  strategy: RoutingStrategy;
  /** 健康检查间隔（毫秒） */
  healthCheckInterval: number;
  /** 故障转移 */
  failover: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelay: number;
}

/**
 * 连接路由器
 */
export class ConnectionRouter {
  private nodes: Map<string, DatabaseNode> = new Map();
  private config: RouterConfig;
  private roundRobinIndex: number = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  /** 每个节点的活跃连接计数（用于 least-connections 策略） */
  private activeConnections: Map<string, number> = new Map();

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = {
      readWriteSplit: false,
      strategy: 'round-robin',
      healthCheckInterval: 30000,
      failover: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * 添加数据库节点
   */
  addNode(node: DatabaseNode): void {
    this.nodes.set(node.id, {
      ...node,
      healthy: true,
      lastHealthCheck: new Date(),
    });
  }

  /**
   * 移除数据库节点
   */
  removeNode(nodeId: string): boolean {
    this.activeConnections.delete(nodeId);
    return this.nodes.delete(nodeId);
  }

  /**
   * 获取指定节点
   */
  getNode(nodeId: string): DatabaseNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): DatabaseNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取写节点
   */
  getWriteNode(): DatabaseNode | null {
    const writeNodes = this.getHealthyNodes().filter(
      (n) => n.role === 'master' || n.role === 'writer' || n.role === 'all'
    );

    if (writeNodes.length === 0) {
      return null;
    }

    return this.selectNode(writeNodes);
  }

  /**
   * 获取读节点
   */
  getReadNode(): DatabaseNode | null {
    let readNodes: DatabaseNode[];

    if (this.config.readWriteSplit) {
      // 优先使用从节点
      readNodes = this.getHealthyNodes().filter(
        (n) => n.role === 'slave' || n.role === 'reader'
      );
      // 如果没有从节点，使用主节点
      if (readNodes.length === 0) {
        readNodes = this.getHealthyNodes().filter(
          (n) => n.role === 'master' || n.role === 'writer' || n.role === 'all'
        );
      }
    } else {
      readNodes = this.getHealthyNodes();
    }

    if (readNodes.length === 0) {
      return null;
    }

    return this.selectNode(readNodes);
  }

  /**
   * 获取健康的节点
   */
  private getHealthyNodes(): DatabaseNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => n.enabled && n.healthy
    );
  }

  /**
   * 根据策略选择节点
   */
  private selectNode(nodes: DatabaseNode[]): DatabaseNode {
    if (nodes.length === 1) {
      return nodes[0];
    }

    switch (this.config.strategy) {
      case 'round-robin':
        return this.roundRobinSelect(nodes);
      case 'random':
        return this.randomSelect(nodes);
      case 'weight':
        return this.weightedSelect(nodes);
      case 'least-connections':
        return this.leastConnectionsSelect(nodes);
      default:
        return this.roundRobinSelect(nodes);
    }
  }

  /**
   * 轮询选择
   */
  private roundRobinSelect(nodes: DatabaseNode[]): DatabaseNode {
    const node = nodes[this.roundRobinIndex % nodes.length];
    this.roundRobinIndex++;
    return node;
  }

  /**
   * 随机选择
   */
  private randomSelect(nodes: DatabaseNode[]): DatabaseNode {
    const index = Math.floor(Math.random() * nodes.length);
    return nodes[index];
  }

  /**
   * 权重选择
   */
  private weightedSelect(nodes: DatabaseNode[]): DatabaseNode {
    const totalWeight = nodes.reduce((sum, n) => sum + n.weight, 0);
    let random = Math.random() * totalWeight;

    for (const node of nodes) {
      random -= node.weight;
      if (random <= 0) {
        return node;
      }
    }

    return nodes[0];
  }

  /**
   * 最少连接选择
   */
  private leastConnectionsSelect(nodes: DatabaseNode[]): DatabaseNode {
    let minNode = nodes[0];
    let minCount = this.activeConnections.get(nodes[0].id) || 0;

    for (let i = 1; i < nodes.length; i++) {
      const count = this.activeConnections.get(nodes[i].id) || 0;
      if (count < minCount) {
        minCount = count;
        minNode = nodes[i];
      }
    }

    return minNode;
  }

  /**
   * 增加节点活跃连接计数
   * 注意：Node.js 单线程模型下同步操作天然原子，
   * 但若未来引入 Worker Threads 需改用 Atomics
   */
  acquireConnection(nodeId: string): void {
    this.activeConnections.set(nodeId, (this.activeConnections.get(nodeId) || 0) + 1);
  }

  /**
   * 减少节点活跃连接计数
   */
  releaseConnection(nodeId: string): void {
    this.activeConnections.set(nodeId, Math.max(0, (this.activeConnections.get(nodeId) || 0) - 1));
  }

  /**
   * 获取节点活跃连接数
   */
  getActiveConnectionCount(nodeId: string): number {
    return this.activeConnections.get(nodeId) || 0;
  }

  /**
   * 标记节点为不健康
   */
  markUnhealthy(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.healthy = false;
      node.lastHealthCheck = new Date();
    }
  }

  /**
   * 标记节点为健康
   */
  markHealthy(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.healthy = true;
      node.lastHealthCheck = new Date();
    }
  }

  /**
   * 启用节点
   */
  enableNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.enabled = true;
    }
  }

  /**
   * 禁用节点
   */
  disableNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.enabled = false;
    }
  }

  /**
   * 执行健康检查
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [id, node] of this.nodes) {
      if (!node.enabled || !node.manager) {
        results.set(id, false);
        continue;
      }

      try {
        const healthy = await node.manager.healthCheck?.() ?? true;
        node.healthy = healthy;
        node.lastHealthCheck = new Date();
        results.set(id, healthy);
      } catch (error) {
        node.healthy = false;
        node.lastHealthCheck = new Date();
        results.set(id, false);
      }
    }

    return results;
  }

  /**
   * 启动健康检查定时器
   */
  startHealthCheck(): void {
    if (this.healthCheckTimer) {
      this.stopHealthCheck();
    }

    this.healthCheckTimer = setInterval(
      () => this.healthCheck(),
      this.config.healthCheckInterval
    );
  }

  /**
   * 停止健康检查定时器
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * 带重试的执行
   */
  async executeWithRetry<T>(
    operation: (node: DatabaseNode) => Promise<T>,
    isWrite: boolean = false
  ): Promise<T> {
    let lastError: Error | null = null;
    let retries = 0;

    while (retries < this.config.maxRetries) {
      const node = isWrite ? this.getWriteNode() : this.getReadNode();

      if (!node) {
        throw new Error('No available database nodes');
      }

      try {
        return await operation(node);
      } catch (error) {
        lastError = error as Error;
        this.markUnhealthy(node.id);

        if (this.config.failover) {
          retries++;
          if (retries < this.config.maxRetries) {
            await this.delay(this.config.retryDelay);
          }
        } else {
          break;
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 热切换到新节点
   * @param oldNodeId 旧节点 ID
   * @param newNode 新节点配置
   */
  async hotSwitch(oldNodeId: string, newNode: DatabaseNode): Promise<void> {
    // 1. 添加新节点
    this.addNode(newNode);

    // 2. 检查新节点健康
    if (newNode.manager?.healthCheck) {
      const healthy = await newNode.manager.healthCheck();
      if (!healthy) {
        this.removeNode(newNode.id);
        throw new Error('New node health check failed');
      }
    }

    // 3. 禁用旧节点
    this.disableNode(oldNodeId);

    // 4. 等待进行中的操作完成（可配置）
    await this.delay(1000);

    // 5. 移除旧节点
    const oldNode = this.getNode(oldNodeId);
    if (oldNode?.manager?.close) {
      await oldNode.manager.close();
    }
    this.removeNode(oldNodeId);
  }

  /**
   * 获取路由状态
   */
  getStatus(): {
    totalNodes: number;
    healthyNodes: number;
    enabledNodes: number;
    totalActiveConnections: number;
    nodeDetails: Array<{
      id: string;
      role: NodeRole;
      healthy: boolean;
      enabled: boolean;
      activeConnections: number;
      lastHealthCheck?: Date;
    }>;
    config: RouterConfig;
  } {
    const nodes = Array.from(this.nodes.values());
    let totalActive = 0;

    const nodeDetails = nodes.map((n) => {
      const active = this.activeConnections.get(n.id) || 0;
      totalActive += active;
      return {
        id: n.id,
        role: n.role,
        healthy: n.healthy,
        enabled: n.enabled,
        activeConnections: active,
        lastHealthCheck: n.lastHealthCheck,
      };
    });

    return {
      totalNodes: nodes.length,
      healthyNodes: nodes.filter((n) => n.healthy).length,
      enabledNodes: nodes.filter((n) => n.enabled).length,
      totalActiveConnections: totalActive,
      nodeDetails,
      config: this.config,
    };
  }

  /**
   * 销毁路由器
   */
  async destroy(): Promise<void> {
    this.stopHealthCheck();

    // 关闭所有节点连接
    for (const node of this.nodes.values()) {
      if (node.manager?.close) {
        await node.manager.close();
      }
    }

    this.nodes.clear();
  }
}

/**
 * 创建连接路由器的工厂函数
 */
export function createConnectionRouter(config?: Partial<RouterConfig>): ConnectionRouter {
  return new ConnectionRouter(config);
}
