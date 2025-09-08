// Offline functionality for orders
class OfflineManager {
  constructor() {
    this.dbName = 'KimoPOS';
    this.dbVersion = 2;
    this.db = null;
    this.initialized = false;
    this.isOpening = false;
    this.pendingOperations = [];
    this.initPromise = this.init();
  }

  async init() {
    if (this.isOpening) {
      return this.initPromise;
    }
    
    this.isOpening = true;
    try {
      this.db = await this.openDatabase();
      this.initialized = true;
      console.log('Offline database initialized');
      
      // Process any pending operations
      while (this.pendingOperations.length > 0) {
        const operation = this.pendingOperations.shift();
        this.executeOperation(operation);
      }
      
      return this.db;
    } catch (error) {
      console.error('Failed to initialize offline database:', error);
      // Reject pending operations
      while (this.pendingOperations.length > 0) {
        const operation = this.pendingOperations.shift();
        operation.reject(error);
      }
      throw error;
    } finally {
      this.isOpening = false;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
    return this.db;
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log('IndexedDB opened successfully');
        const db = request.result;
        
        // Handle database connection closing
        db.onerror = (event) => {
          console.error('Database error:', event.target.error);
        };
        
        db.onclose = () => {
          console.log('Database connection closed');
          this.initialized = false;
          this.db = null;
        };
        
        db.onversionchange = () => {
          console.log('Database version changed, closing connection');
          db.close();
        };
        
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        console.log('IndexedDB upgrade needed');
        const db = event.target.result;
        
        // Create object store for offline orders
        if (!db.objectStoreNames.contains('offlineOrders')) {
          const store = db.createObjectStore('offlineOrders', { 
            keyPath: 'id',
            autoIncrement: true 
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('table_id', 'table_id', { unique: false });
        }

        // Create object store for table status
        if (!db.objectStoreNames.contains('tables')) {
          const store = db.createObjectStore('tables', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
        }

        // Create object store for sync queue
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('type', 'type', { unique: false });
        }
      };
      
      request.onblocked = () => {
        console.warn('IndexedDB open request blocked');
      };
    });
  }

  // Helper method to execute operations with proper error handling
  async executeOperation(operation) {
    try {
      await this.ensureInitialized();
      
      // Check if database is still open
      if (!this.db || this.db.version === 0) {
        throw new Error('Database connection is closed');
      }
      
      const transaction = this.db.transaction(operation.stores, operation.mode);
      const store = transaction.objectStore(operation.storeName);
      
      return new Promise((resolve, reject) => {
        const request = operation.action(store);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => {
          if (operation.resolve) {
            operation.resolve(request.result);
          }
        };
        transaction.onabort = () => {
          if (operation.reject) {
            operation.reject(transaction.error || new Error('Transaction aborted'));
          }
        };
      });
    } catch (error) {
      console.error('Error executing operation:', error);
      
      // If database connection is closed, try to reopen it
      if (error.name === 'InvalidStateError' || error.message.includes('closed')) {
        console.log('Database connection closed, attempting to reopen...');
        this.initialized = false;
        await this.init();
        return this.executeOperation(operation);
      }
      
      throw error;
    }
  }

  // Queue operation for execution
  queueOperation(operation) {
    return new Promise((resolve, reject) => {
      const op = {
        ...operation,
        resolve,
        reject
      };
      
      if (this.initialized) {
        this.executeOperation(op);
      } else {
        this.pendingOperations.push(op);
      }
    });
  }

  // Save order for offline sync
  async saveOfflineOrder(orderData) {
    return this.queueOperation({
      stores: ['offlineOrders'],
      mode: 'readwrite',
      storeName: 'offlineOrders',
      action: (store) => {
        const order = {
          ...orderData,
          timestamp: new Date().getTime(),
          status: 'pending',
          offline: true
        };
        return store.add(order);
      }
    });
  }

  // Get all offline orders
  async getOfflineOrders() {
    return this.queueOperation({
      stores: ['offlineOrders'],
      mode: 'readonly',
      storeName: 'offlineOrders',
      action: (store) => store.getAll()
    });
  }

  // Get offline orders for a specific table
  async getOfflineOrdersForTable(tableId) {
    return this.queueOperation({
      stores: ['offlineOrders'],
      mode: 'readonly',
      storeName: 'offlineOrders',
      action: (store) => {
        const index = store.index('table_id');
        return index.getAll(tableId);
      }
    });
  }

  // Remove order after successful sync
  async removeOfflineOrder(orderId) {
    return this.queueOperation({
      stores: ['offlineOrders'],
      mode: 'readwrite',
      storeName: 'offlineOrders',
      action: (store) => store.delete(orderId)
    });
  }

  // Update table status offline
  async updateTableStatus(tableId, status) {
    return this.queueOperation({
      stores: ['tables'],
      mode: 'readwrite',
      storeName: 'tables',
      action: (store) => {
        const table = {
          id: tableId,
          status: status,
          updatedAt: new Date().getTime()
        };
        return store.put(table);
      }
    });
  }

  // Get table status
  async getTableStatus(tableId) {
    return this.queueOperation({
      stores: ['tables'],
      mode: 'readonly',
      storeName: 'tables',
      action: (store) => store.get(tableId)
    });
  }

  // Get all tables status
  async getAllTablesStatus() {
    return this.queueOperation({
      stores: ['tables'],
      mode: 'readonly',
      storeName: 'tables',
      action: (store) => store.getAll()
    });
  }

  // Add to sync queue
  async addToSyncQueue(data, type) {
    return this.queueOperation({
      stores: ['syncQueue'],
      mode: 'readwrite',
      storeName: 'syncQueue',
      action: (store) => {
        const item = {
          data: data,
          type: type,
          timestamp: new Date().getTime()
        };
        return store.add(item);
      }
    });
  }

  // Get sync queue items
  async getSyncQueue() {
    return this.queueOperation({
      stores: ['syncQueue'],
      mode: 'readonly',
      storeName: 'syncQueue',
      action: (store) => store.getAll()
    });
  }

  // Remove from sync queue
  async removeFromSyncQueue(id) {
    return this.queueOperation({
      stores: ['syncQueue'],
      mode: 'readwrite',
      storeName: 'syncQueue',
      action: (store) => store.delete(id)
    });
  }
}

// Create global offline manager
window.offlineManager = new OfflineManager();