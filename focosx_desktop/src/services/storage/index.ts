import ProxyStorage from "./ProxyStorage";
import { ensureDefaultStructure } from "./utils";
import IStorageAdapter from "./IStorageAdapter";

export { ensureDefaultStructure };
export type { IStorageAdapter };

export const storage: IStorageAdapter = new (ProxyStorage as any)();

export default storage;
