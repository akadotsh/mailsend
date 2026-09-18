import Keytar from "keytar";

interface SecretStore {
  set: (key: string, value: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  delete: (key: string) => Promise<boolean>;
}

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
