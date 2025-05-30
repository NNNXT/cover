import Setting from "../setting";
import Log from "./log";

class Cache {
    downloaded = {};
    source = {};
    thank = {};
    detail = {};
    data = {
        downloadFinishTimeout: 0,
        welcomeMessage: 0,
        warning: 0,
        warningCode: '',
    };
    code;
    version = 0;

    constructor() {
        Log('Cache loading...');

        this.read();

        Log('Cache Done');
    }

    set({ key, data, merge = true }) {
        if(typeof data === 'object' && data.hasOwnProperty('key')) {
            if(merge === true && typeof data.value === 'object') {
                this[key][data.key] = { ...this[key][data.key], ...data.value };
            } else {
                this[key][data.key] = data.value;
            }
        } else {
            this[key] = data;
        }

        let rand = Math.random();
        this.code = rand;
        setTimeout(() => this.write(rand), 1000);

        Log(`set cache ${key}: ${data.key}, ${data.value?.source ?? data.value}`);
    }

    read() {
        if(Setting.cache === false) return;

        let caches = localStorage.getItem(`${Setting.key}_CACHE`);
        if(caches) {
            try {
                caches = JSON.parse(caches);
            } catch(e) {
                caches = {};
            }
        }
        this.downloaded = { ...this.downloaded, ...caches?.downloaded };
        this.source = { ...this.source, ...caches?.source };
        this.thank = { ...this.thank, ...caches?.thank };
        this.detail = { ...this.detail, ...caches?.detail };
        this.data = { ...this.data, ...caches?.data };
        this.version = caches?.version ?? 0;

        //clean old cache
        if(this.version !== Setting.version) {
            this.set({
                key: 'data', data: {
                    key: 'welcomeMessage',
                    value: 0,
                }
            });
            this.set({
                key: 'data', data: {
                    key: 'warning',
                    value: 0,
                }
            });
            this.set({ key: 'version', data: Setting.version });
        }
    }

    write(code) {
        if(Setting.cache === false) return;

        if(this.code === code) {
            this.timeout();

            localStorage.setItem(`${Setting.key}_CACHE`, JSON.stringify({
                downloaded: { ...this.downloaded },
                source: { ...this.source },
                thank: { ...this.thank },
                detail: { ...this.detail },
                data: { ...this.data },
                version: this.version,
            }));

            Log('write cache');
        }
    }

    timeout() {
        Log('clear source timeout');

        Object.keys(this.source).forEach(key => {
            if(!this.source[key].hasOwnProperty('timeout')) {
                this.source[key].timeout = this.timestamp() + Setting.cacheTimeout;
            } else if(this.source[key].timeout < this.timestamp()) {
                delete this.source[key];

                Log(`delete cache source ${key}`);
            }
        });

        Object.keys(this.detail).forEach(key => {
            if(!this.detail[key].hasOwnProperty('timeout')) {
                this.detail[key].timeout = this.timestamp() + Setting.cacheTimeout;
            } else if(this.detail[key].timeout < this.timestamp()) {
                delete this.detail[key];

                Log(`delete cache detail ${key}`);
            }
        });
    }

    timestamp() {
        return (Date.now() / 1000 | 0);
    }

    static clean() {
        localStorage.setItem(`${Setting.key}_CACHE`, '{}');
    }
}

export default Cache;
