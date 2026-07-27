const sharedSportsRepositories = window.SportsRepositories || window.FootballRepositories || {};
window.SportsRepositories = sharedSportsRepositories;
window.FootballRepositories = sharedSportsRepositories;

(function initializeSportsRepositories(namespace) {
  const asArray = value => (Array.isArray(value) ? value : []);
  const unique = values => [...new Set(asArray(values).map(String).filter(Boolean))];

  class SportsRepository {
    clear() {}
  }

  class JsonRepository extends SportsRepository {
    constructor(path, { cache = true } = {}) {
      super();
      this.path = path;
      this.cacheEnabled = cache;
      this.cache = null;
      this.pending = null;
    }

    async get({ fresh = false } = {}) {
      if (this.cacheEnabled && this.cache && !fresh) return this.cache;
      if (this.pending && !fresh) return this.pending;

      const separator = this.path.includes('?') ? '&' : '?';
      this.pending = fetch(`${this.path}${separator}v=${Date.now()}`, { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${this.path}`);
          return response.json();
        })
        .then(data => {
          if (this.cacheEnabled) this.cache = data;
          return data;
        })
        .finally(() => {
          this.pending = null;
        });
      return this.pending;
    }

    clear() {
      this.cache = null;
      this.pending = null;
    }
  }

  class StorageRepository extends SportsRepository {
    constructor(storage = window.localStorage) {
      super();
      this.storage = storage;
    }

    get(key, fallback = null) {
      try {
        const raw = this.storage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    }

    set(key, value) {
      this.storage.setItem(key, JSON.stringify(value));
      return value;
    }

    remove(key) {
      this.storage.removeItem(key);
    }

    has(key) {
      return this.storage.getItem(key) !== null;
    }
  }

  class SportsCollectionRepository extends SportsRepository {
    constructor({ key, storage = new StorageRepository() } = {}) {
      super();
      this.key = key;
      this.storage = storage;
    }

    normalize(values) {
      return unique(values);
    }

    list() {
      return this.normalize(this.storage.get(this.key, []));
    }

    replace(values) {
      return this.storage.set(this.key, this.normalize(values));
    }

    clear() {
      this.storage.remove(this.key);
    }
  }

  class FavoriteRepository extends SportsCollectionRepository {
    constructor({ key, legacyKey = null, storage = new StorageRepository() } = {}) {
      super({ key, storage });
      this.legacyKey = legacyKey;
    }

    list() {
      const stored = this.storage.get(this.key, null);
      if (Array.isArray(stored)) return this.normalize(stored);

      if (this.legacyKey) {
        const legacy = this.storage.get(this.legacyKey, null);
        if (legacy) {
          const migrated = [String(legacy)];
          this.replace(migrated);
          this.storage.remove(this.legacyKey);
          return migrated;
        }
      }
      return [];
    }

    add(id) {
      return this.replace([...this.list(), String(id)]);
    }

    remove(id) {
      return this.replace(this.list().filter(value => value !== String(id)));
    }

    has(id) {
      return this.list().includes(String(id));
    }
  }

  class SettingsRepository extends SportsRepository {
    constructor({ prefix = 'sports', storage = new StorageRepository() } = {}) {
      super();
      this.prefix = prefix;
      this.storage = storage;
    }

    key(name) {
      return `${this.prefix}:${name}`;
    }

    get(name, fallback = null) {
      return this.storage.get(this.key(name), fallback);
    }

    set(name, value) {
      return this.storage.set(this.key(name), value);
    }

    remove(name) {
      this.storage.remove(this.key(name));
    }
  }

  Object.assign(namespace, {
    SportsRepository,
    SportsCollectionRepository,
    JsonRepository,
    StorageRepository,
    FavoriteRepository,
    SettingsRepository,
    asArray,
    unique
  });
})(sharedSportsRepositories);
