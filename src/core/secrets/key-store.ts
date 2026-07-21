import Keytar from "keytar";

import type { SecretStore } from "../types/secret";

export class KeyStore implements SecretStore {
  private readonly name: string;
  constructor(name: string) {
    this.name = name;
  }

  async set(key: string, value: string): Promise<void> {
    await Keytar.setPassword(this.name, key, value);
  }

  async get(key: string): Promise<string | null> {
    return await Keytar.getPassword(this.name, key);
  }

  async delete(key: string): Promise<boolean> {
    return await Keytar.deletePassword(this.name, key);
  }
}
