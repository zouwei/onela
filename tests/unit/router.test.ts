/**
 * ConnectionRouter 全面单元测试
 * 覆盖: 节点管理、路由策略、健康检查、热切换、连接计数
 */

import { ConnectionRouter, createConnectionRouter } from '../../src/router/ConnectionRouter.js';
import type { DatabaseNode } from '../../src/router/ConnectionRouter.js';

function createNode(id: string, role: 'master' | 'slave' = 'master', weight = 1): DatabaseNode {
  return { id, role, weight, enabled: true, healthy: true, config: {}, type: 'mysql' };
}

describe('ConnectionRouter', () => {
  describe('node management', () => {
    let router: ConnectionRouter;

    beforeEach(() => {
      router = createConnectionRouter();
    });

    it('should add and get node', () => {
      router.addNode(createNode('n1'));
      expect(router.getNode('n1')).toBeDefined();
      expect(router.getNode('n1')?.id).toBe('n1');
    });

    it('should remove node', () => {
      router.addNode(createNode('n1'));
      expect(router.removeNode('n1')).toBe(true);
      expect(router.getNode('n1')).toBeUndefined();
    });

    it('should return all nodes', () => {
      router.addNode(createNode('n1'));
      router.addNode(createNode('n2'));
      expect(router.getAllNodes().length).toBe(2);
    });
  });

  describe('getWriteNode', () => {
    it('should return master node', () => {
      const router = createConnectionRouter();
      router.addNode(createNode('master', 'master'));
      router.addNode(createNode('slave', 'slave'));
      const node = router.getWriteNode();
      expect(node?.role).toBe('master');
    });

    it('should return null when no write nodes', () => {
      const router = createConnectionRouter();
      router.addNode(createNode('slave', 'slave'));
      expect(router.getWriteNode()).toBeNull();
    });

    it('should skip unhealthy nodes', () => {
      const router = createConnectionRouter();
      router.addNode(createNode('m1', 'master'));
      router.markUnhealthy('m1');
      expect(router.getWriteNode()).toBeNull();
    });
  });

  describe('getReadNode', () => {
    it('should return any node without read/write split', () => {
      const router = createConnectionRouter({ readWriteSplit: false });
      router.addNode(createNode('m1', 'master'));
      const node = router.getReadNode();
      expect(node).toBeDefined();
    });

    it('should prefer slave nodes with read/write split', () => {
      const router = createConnectionRouter({ readWriteSplit: true });
      router.addNode(createNode('master', 'master'));
      router.addNode(createNode('slave', 'slave'));
      // With read/write split, slaves are preferred
      const node = router.getReadNode();
      expect(node?.role).toBe('slave');
    });

    it('should fall back to master when no slaves', () => {
      const router = createConnectionRouter({ readWriteSplit: true });
      router.addNode(createNode('master', 'master'));
      const node = router.getReadNode();
      expect(node?.role).toBe('master');
    });

    it('should return null when no healthy nodes', () => {
      const router = createConnectionRouter();
      expect(router.getReadNode()).toBeNull();
    });
  });

  describe('routing strategies', () => {
    describe('round-robin', () => {
      it('should distribute across nodes', () => {
        const router = createConnectionRouter({ strategy: 'round-robin' });
        router.addNode(createNode('n1', 'master'));
        router.addNode(createNode('n2', 'master'));
        const ids = new Set<string>();
        for (let i = 0; i < 4; i++) {
          ids.add(router.getWriteNode()!.id);
        }
        expect(ids.size).toBe(2);
      });
    });

    describe('random', () => {
      it('should return a node', () => {
        const router = createConnectionRouter({ strategy: 'random' });
        router.addNode(createNode('n1', 'master'));
        router.addNode(createNode('n2', 'master'));
        expect(router.getWriteNode()).toBeDefined();
      });
    });

    describe('weight', () => {
      it('should return a node', () => {
        const router = createConnectionRouter({ strategy: 'weight' });
        const n1 = createNode('n1', 'master');
        n1.weight = 10;
        const n2 = createNode('n2', 'master');
        n2.weight = 1;
        router.addNode(n1);
        router.addNode(n2);
        expect(router.getWriteNode()).toBeDefined();
      });
    });

    describe('least-connections', () => {
      it('should select node with fewest connections', () => {
        const router = createConnectionRouter({ strategy: 'least-connections' });
        router.addNode(createNode('n1', 'master'));
        router.addNode(createNode('n2', 'master'));
        // Simulate n1 having more connections
        router.acquireConnection('n1');
        router.acquireConnection('n1');
        router.acquireConnection('n1');
        router.acquireConnection('n2');
        const node = router.getWriteNode();
        expect(node?.id).toBe('n2');
      });
    });
  });

  describe('connection tracking', () => {
    it('should track acquire and release', () => {
      const router = createConnectionRouter();
      router.addNode(createNode('n1'));
      router.acquireConnection('n1');
      router.acquireConnection('n1');
      expect(router.getActiveConnectionCount('n1')).toBe(2);
      router.releaseConnection('n1');
      expect(router.getActiveConnectionCount('n1')).toBe(1);
    });

    it('should not go below zero', () => {
      const router = createConnectionRouter();
      router.addNode(createNode('n1'));
      router.releaseConnection('n1');
      expect(router.getActiveConnectionCount('n1')).toBe(0);
    });

    it('should clean up on node removal', () => {
      const router = createConnectionRouter();
      router.addNode(createNode('n1'));
      router.acquireConnection('n1');
      router.removeNode('n1');
      expect(router.getActiveConnectionCount('n1')).toBe(0);
    });
  });

  describe('health management', () => {
    it('should mark node unhealthy', () => {
      const router = createConnectionRouter();
      router.addNode(createNode('n1'));
      router.markUnhealthy('n1');
      expect(router.getNode('n1')?.healthy).toBe(false);
    });

    it('should mark node healthy', () => {
      const router = createConnectionRouter();
      router.addNode(createNode('n1'));
      router.markUnhealthy('n1');
      router.markHealthy('n1');
      expect(router.getNode('n1')?.healthy).toBe(true);
    });

    it('should disable/enable node', () => {
      const router = createConnectionRouter();
      router.addNode(createNode('n1'));
      router.disableNode('n1');
      expect(router.getNode('n1')?.enabled).toBe(false);
      expect(router.getWriteNode()).toBeNull();
      router.enableNode('n1');
      expect(router.getWriteNode()?.id).toBe('n1');
    });
  });

  describe('executeWithRetry', () => {
    it('should execute operation successfully', async () => {
      const router = createConnectionRouter();
      router.addNode(createNode('n1'));
      const result = await router.executeWithRetry(async (node) => {
        return `ok:${node.id}`;
      });
      expect(result).toBe('ok:n1');
    });

    it('should retry on failure and failover', async () => {
      const router = createConnectionRouter({ failover: true, maxRetries: 3, retryDelay: 10 });
      router.addNode(createNode('n1', 'master'));
      router.addNode(createNode('n2', 'master'));
      let attempts = 0;
      const result = await router.executeWithRetry(async (node) => {
        attempts++;
        if (attempts === 1) throw new Error('fail');
        return 'ok';
      }, true);
      expect(result).toBe('ok');
      expect(attempts).toBe(2);
    });

    it('should throw after max retries', async () => {
      const router = createConnectionRouter({ failover: true, maxRetries: 2, retryDelay: 10 });
      router.addNode(createNode('n1', 'master'));
      router.addNode(createNode('n2', 'master'));
      await expect(router.executeWithRetry(async () => {
        throw new Error('always fail');
      }, true)).rejects.toThrow('always fail');
    });

    it('should throw immediately without failover', async () => {
      const router = createConnectionRouter({ failover: false });
      router.addNode(createNode('n1', 'master'));
      await expect(router.executeWithRetry(async () => {
        throw new Error('fail');
      }, true)).rejects.toThrow('fail');
    });

    it('should throw when no nodes available', async () => {
      const router = createConnectionRouter();
      await expect(router.executeWithRetry(async () => 'ok')).rejects.toThrow('No available');
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive status', () => {
      const router = createConnectionRouter({ strategy: 'round-robin' });
      router.addNode(createNode('n1', 'master'));
      router.addNode(createNode('n2', 'slave'));
      router.markUnhealthy('n2');
      router.acquireConnection('n1');
      router.acquireConnection('n1');

      const status = router.getStatus();
      expect(status.totalNodes).toBe(2);
      expect(status.healthyNodes).toBe(1);
      expect(status.enabledNodes).toBe(2);
      expect(status.totalActiveConnections).toBe(2);
      expect(status.nodeDetails.length).toBe(2);
      expect(status.nodeDetails.find(n => n.id === 'n1')?.activeConnections).toBe(2);
      expect(status.config.strategy).toBe('round-robin');
    });
  });

  describe('destroy', () => {
    it('should clear all nodes', async () => {
      const router = createConnectionRouter();
      router.addNode(createNode('n1'));
      router.addNode(createNode('n2'));
      await router.destroy();
      expect(router.getAllNodes().length).toBe(0);
    });
  });
});
