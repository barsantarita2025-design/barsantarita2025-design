// =============================================================================
// BARFLOW - SERVICIO DE CONEXIÓN SERIAL PARA GAVETA DE DINERO
// =============================================================================
// @platform Windows, Linux (Raspberry Pi)
// @requires serialport npm package
// =============================================================================

import type { HardwareConfig, SerialEvent, SerialEventType } from '../types-pos';
import { EventEmitter } from 'events';

// -----------------------------------------------------------------------------
// INTERFAZ DEL PUERTO SERIAL (ABSTRACCIÓN)
// -----------------------------------------------------------------------------

interface SerialPortInterface {
  isOpen: boolean;
  portName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  write(data: Buffer | string): Promise<void>;
  on(event: 'data' | 'error' | 'close', listener: (data: Buffer | Error | void) => void): this;
  removeAllListeners(event?: string): this;
}

// -----------------------------------------------------------------------------
// CONFIGURACIÓN DEFAULT
// -----------------------------------------------------------------------------

const DEFAULT_CONFIG: Partial<HardwareConfig> = {
  cashDrawerPort: 'COM1',
  cashDrawerBaudRate: 9600,
  drawerOpenPulseMs: 200,
  pollingIntervalMs: 500,
  maxDrawerOpenMs: 5000,
  cashDrawerEnabled: true,
  drawerSensorEnabled: false,
};

// -----------------------------------------------------------------------------
// EXCEPCIONES PERSONALIZADAS
// -----------------------------------------------------------------------------

export class SerialConnectionError extends Error {
  constructor(message: string, public readonly port?: string, public readonly code?: string) {
    super(message);
    this.name = 'SerialConnectionError';
  }
}

export class DrawerCommandError extends Error {
  constructor(message: string, public readonly command: string) {
    super(message);
    this.name = 'DrawerCommandError';
  }
}

export class HardwareNotAvailableError extends Error {
  constructor(feature: string) {
    super(`Hardware feature not available: ${feature}`);
    this.name = 'HardwareNotAvailableError';
  }
}

// -----------------------------------------------------------------------------
// SERVICIO PRINCIPAL DE CONEXIÓN SERIAL
// -----------------------------------------------------------------------------

export class SerialDrawerService extends EventEmitter {
  private config: HardwareConfig;
  private port: SerialPortInterface | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private pollingTimer: NodeJS.Timeout | null = null;
  private simulationMode: boolean = false;
  private drawerState: 'OPEN' | 'CLOSED' = 'CLOSED';

  constructor(config: Partial<HardwareConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as HardwareConfig;
    this.detectPlatform();
  }

  // -------------------------------------------------------------------------
  // DETECCIÓN DE PLATAFORMA
  // -------------------------------------------------------------------------

  private detectPlatform(): void {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: usa puertos COM (COM1, COM2, etc.)
      this.config.cashDrawerPort = this.config.cashDrawerPort || 'COM1';
    } else if (platform === 'linux') {
      // Linux/Raspberry Pi: puede usar /dev/ttyUSB* o /dev/ttyACM*
      this.config.cashDrawerPort = this.config.cashDrawerPort || '/dev/ttyUSB0';
    } else {
      // macOS u otros: activa modo simulación
      console.warn(`Plataforma ${platform} no soportada nativamente, usando modo simulación`);
      this.simulationMode = true;
    }
  }

  // -------------------------------------------------------------------------
  // CONEXIÓN/DESCONEXIÓN
  // -------------------------------------------------------------------------

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('Ya conectado al puerto serial');
      return;
    }

    if (this.simulationMode) {
      this.isConnected = true;
      this.emitSerialEvent('CONNECTED', 'SIMULATION');
      console.info('[SIMULATION] Modo simulación activado para gaveta');
      return;
    }

    try {
      // Intentar importar serialport dinámicamente
      const SerialPortModule = await this.loadSerialPortModule();

      if (!SerialPortModule) {
        this.simulationMode = true;
        this.isConnected = true;
        this.emitSerialEvent('CONNECTED', 'SIMULATION');
        console.info('[SIMULATION] Modo simulación activado para gaveta');
        return;
      }

      // @ts-ignore - El tipo viene del módulo externo en tiempo de ejecución
      const SerialPort = (SerialPortModule as { default: new (options: object) => any }).default ||
        (SerialPortModule as new (options: object) => any);

      this.port = new SerialPort({
        path: this.config.cashDrawerPort,
        baudRate: this.config.cashDrawerBaudRate,
        autoOpen: false,
      });

      this.setupPortListeners();

      await this.openPort();

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emitSerialEvent('CONNECTED', this.config.cashDrawerPort);

      // Iniciar polling del sensor si está habilitado
      if (this.config.drawerSensorEnabled) {
        this.startSensorPolling();
      }

    } catch (error) {
      this.handleConnectionError(error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopSensorPolling();

    if (this.port && this.port.isOpen) {
      await this.closePort();
    }

    this.port = null;
    this.isConnected = false;
    this.emitSerialEvent('DISCONNECTED');
  }

  private async loadSerialPortModule(): Promise<unknown> {
    // Detectar si estamos en un entorno de navegador
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

    // Si estamos en el navegador, forzar modo simulación y no cargar serialport
    if (isBrowser) {
      console.warn('Entorno navegador detectado: SerialPort no disponible, activando modo simulación');
      this.simulationMode = true;
      return null;
    }

    try {
      // Intentar importar SerialPort solo en entorno Node/Electron
      // Usamos una variable y @vite-ignore para evitar que Vite intente empaquetarlo
      const moduleName = 'serialport';
      // @ts-ignore
      const SerialPort = await import(/* @vite-ignore */ moduleName);
      return SerialPort;
    } catch (error) {
      console.warn('SerialPort no disponible o error al cargar, activando modo simulación:', error);
      this.simulationMode = true;
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // LISTENERS DEL PUERTO
  // -------------------------------------------------------------------------

  private setupPortListeners(): void {
    if (!this.port) return;

    this.port.on('data', (data: Buffer) => {
      this.handleSerialData(data);
    });

    this.port.on('error', (error: Error) => {
      this.emitSerialEvent('ERROR', undefined, undefined, error.message);
      this.handleConnectionError(error);
    });

    this.port.on('close', () => {
      this.isConnected = false;
      this.emitSerialEvent('DISCONNECTED');
    });
  }

  private handleSerialData(data: Buffer): void {
    // Procesar datos del sensor de la gaveta
    const dataStr = data.toString().trim();

    if (dataStr.includes('OPEN')) {
      this.drawerState = 'OPEN';
      this.emitSerialEvent('DRAWER_OPENED');
    } else if (dataStr.includes('CLOSE')) {
      this.drawerState = 'CLOSED';
      this.emitSerialEvent('DRAWER_CLOSED');
    }
  }

  // -------------------------------------------------------------------------
  // OPERACIONES DE LA GAVETA
  // -------------------------------------------------------------------------

  /**
   * Abre la gaveta de dinero
   * @param pulseDurationMs - Duración del pulso en milisegundos (default: config)
   */
  async openDrawer(pulseDurationMs?: number): Promise<void> {
    const duration = pulseDurationMs || this.config.drawerOpenPulseMs;

    if (this.simulationMode) {
      console.log(`[SIMULATION] Abriendo gaveta por ${duration}ms`);
      await this.simulateDrawerOpen();
      return;
    }

    if (!this.isConnected || !this.port) {
      throw new SerialConnectionError('No hay conexión con el puerto serial');
    }

    try {
      // Comando estándar para abrir gaveta (pulse high)
      // Secuencia de apertura típica: 0x1B 0x70 0x00 (pulso positivo)
      const openCommand = Buffer.from([
        0x1B, 0x70, 0x00,  // ESC p 0x00 (pulso positivo)
        0x19,              // Duración del pulso
        0xFA               // Margen
      ]);

      await this.port.write(openCommand);

      // Mantener abierto por la duración especificada
      await this.delay(duration);

      // Cerrar el pulso (opcional, depende del hardware)
      const closeCommand = Buffer.from([0x1B, 0x70, 0x01, 0x00, 0x00]);
      await this.port.write(closeCommand);

      console.info(`Gaveta abierta exitosamente (${duration}ms)`);
      this.drawerState = 'OPEN';

    } catch (error) {
      throw new DrawerCommandError(
        `Error al abrir la gaveta: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OPEN_COMMAND'
      );
    }
  }

  /**
   * Obtiene el estado actual de la gaveta
   */
  async getDrawerStatus(): Promise<{ isOpen: boolean; isSensorConnected: boolean }> {
    if (this.simulationMode) {
      return {
        isOpen: this.drawerState === 'OPEN',
        isSensorConnected: true
      };
    }

    if (!this.isConnected || !this.port) {
      throw new SerialConnectionError('No hay conexión con el puerto serial');
    }

    try {
      // Enviar comando de estado (depende del hardware)
      const statusCommand = Buffer.from([0x1B, 0x73]); // ESC s = status request
      await this.port.write(statusCommand);

      // Esperar respuesta
      await this.delay(100);

      return {
        isOpen: this.drawerState === 'OPEN',
        isSensorConnected: true
      };

    } catch (error) {
      return {
        isOpen: this.drawerState === 'OPEN',
        isSensorConnected: false
      };
    }
  }

  /**
   * Envía un pulso de apertura manual (puede ser usado por botones externos)
   */
  async sendPulse(): Promise<void> {
    await this.openDrawer(100); // Pulso corto
  }

  // -------------------------------------------------------------------------
  // POLLING DEL SENSOR
  // -------------------------------------------------------------------------

  private startSensorPolling(): void {
    if (!this.config.drawerSensorEnabled) return;

    this.pollingTimer = setInterval(async () => {
      try {
        const status = await this.getDrawerStatus();

        // Detectar cambios de estado
        if (status.isOpen && this.drawerState === 'CLOSED') {
          this.drawerState = 'OPEN';
          this.emitSerialEvent('DRAWER_OPENED');
        } else if (!status.isOpen && this.drawerState === 'OPEN') {
          this.drawerState = 'CLOSED';
          this.emitSerialEvent('DRAWER_CLOSED');
        }

      } catch (error) {
        // Silenciosamente ignorar errores de polling
        console.warn('Error en polling del sensor:', error);
      }
    }, this.config.pollingIntervalMs);
  }

  private stopSensorPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // MODO SIMULACIÓN (PARA DESARROLLO Y TESTING)
  // -------------------------------------------------------------------------

  enableSimulationMode(): void {
    this.simulationMode = true;
    console.info('Modo simulación de gaveta activado');
  }

  disableSimulationMode(): void {
    this.simulationMode = false;
    console.info('Modo simulación de gaveta desactivado');
  }

  private async simulateDrawerOpen(): Promise<void> {
    this.drawerState = 'OPEN';
    this.emitSerialEvent('DRAWER_OPENED');

    // La gaveta se cierra automáticamente después de un tiempo
    setTimeout(() => {
      this.drawerState = 'CLOSED';
      this.emitSerialEvent('DRAWER_CLOSED');
    }, this.config.maxDrawerOpenMs);
  }

  // -------------------------------------------------------------------------
  // EVENTOS Y UTILIDADES
  // -------------------------------------------------------------------------

  private emitSerialEvent(
    type: SerialEventType,
    port?: string,
    data?: string,
    error?: string
  ): void {
    const event: SerialEvent = {
      type,
      port,
      data,
      error,
      timestamp: new Date().toISOString(),
    };

    this.emit('event', event);
    this.emit(type.toLowerCase(), event);
  }

  private async openPort(): Promise<void> {
    if (!this.port) {
      throw new SerialConnectionError('Puerto no inicializado');
    }

    if (this.port.isOpen) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        (this.port as { open: (cb: (err: Error | undefined) => void) => void }).open((err) => {
          if (err) {
            reject(new SerialConnectionError(
              `Error al abrir puerto: ${err.message}`,
              this.config.cashDrawerPort,
              (err as { code?: string }).code
            ));
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(new SerialConnectionError(
          `Error al abrir puerto: ${err instanceof Error ? err.message : 'Unknown error'}`,
          this.config.cashDrawerPort
        ));
      }
    });
  }

  private async closePort(): Promise<void> {
    if (!this.port) {
      return;
    }

    if (!this.port.isOpen) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        (this.port as { close: (cb: (err: Error | undefined) => void) => void }).close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (err) {
        resolve(); // Ignorar errores al cerrar
      }
    });
  }

  private handleConnectionError(error: unknown): void {
    this.isConnected = false;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.warn(`Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

      setTimeout(() => {
        this.connect().catch(() => { }); // Silenciosamente intentar reconectar
      }, 2000 * this.reconnectAttempts);
    } else {
      console.error('Máximo de intentos de reconexión alcanzado');
      this.emitSerialEvent(
        'ERROR',
        this.config.cashDrawerPort,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // -------------------------------------------------------------------------
  // PROPIEDADES PÚBLICAS
  // -------------------------------------------------------------------------

  get isDrawerOpen(): boolean {
    return this.drawerState === 'OPEN';
  }

  get portName(): string {
    return this.config.cashDrawerPort;
  }

  get connectionStatus(): boolean {
    return this.isConnected;
  }

  get simulationStatus(): boolean {
    return this.simulationMode;
  }

  /**
   * Actualiza la configuración del servicio
   */
  updateConfig(newConfig: Partial<HardwareConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.info('Configuración de gaveta actualizada:', this.config);
  }
}

// -----------------------------------------------------------------------------
// INSTANCIA SINGLETON (PATRÓN EXPORTABLE)
// -----------------------------------------------------------------------------

let drawerServiceInstance: SerialDrawerService | null = null;

export function getDrawerService(config?: Partial<HardwareConfig>): SerialDrawerService {
  if (!drawerServiceInstance) {
    drawerServiceInstance = new SerialDrawerService(config);
  }
  return drawerServiceInstance;
}

export function createDrawerService(config?: Partial<HardwareConfig>): SerialDrawerService {
  return new SerialDrawerService(config);
}

// -----------------------------------------------------------------------------
// EXPORTACIÓN PARA USO EN ELECTRON MAIN PROCESS
// -----------------------------------------------------------------------------

// Si estamos en el proceso principal de Electron, exportar para uso con contextBridge
export function setupElectronBridge(): {
  openDrawer: () => Promise<void>;
  getStatus: () => Promise<{ isOpen: boolean }>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
} {
  const service = getDrawerService();

  return {
    openDrawer: () => service.openDrawer(),
    getStatus: () => service.getDrawerStatus(),
    connect: () => service.connect(),
    disconnect: () => service.disconnect(),
  };
}
