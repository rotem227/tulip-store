export type StateValue = any;
export type StateKey = string;
export type GroupName = 'default' | string;
export type RegisteredCallback = (param?: any) => any;
export type Middleware = (param?: StateValue) => StateValue;

export interface ConfigData<T> {
    state: T;
    actions?: {
        [name: string]: (param: T) => T;
    };
    middlewares?: Middleware[];
}

export interface Config {
    [key: string]: ConfigData<any>;
}

export interface Middlewares {
    [key: StateKey]: RegisteredCallback[];
}

interface Stack {
    [key: StateKey]: {
        [index: number]: RegisteredCallback;
    };
}

const isObject = (value: StateValue) => {
    return value !== null && typeof value === 'object' && Array.isArray(value) === false;
}

const cloneValue = (value: StateValue) => {
    if (Array.isArray(value)) {
        return [...value];
    } else if (isObject(value)) {
        const obj = value as Object;

        return { ...obj };
    }

    return value;
}

export default class Group {
    isInitialized = false;

    name: GroupName = '';

    stack: Stack = {};

    middlewares: Middlewares = {};

    state: Config = {};

    registeredIndex = 0;

    addMiddleware(key: StateKey, callback: RegisteredCallback) {
        if (!this.state[key].middlewares) {
            this.state[key].middlewares = [];
        }

        this.state[key].middlewares?.push(callback);
    }

    register(key: StateKey, callback: RegisteredCallback) {
        if (typeof callback !== 'function') {
            return new Error('The registered callback must be a function.');
        }

        if (!this.stack.hasOwnProperty(key)) {
            this.stack[key] = {};
        }

        const registeredNumber = this.registeredIndex;

        const register = () => this.stack[key][registeredNumber] = callback;;
        const unregister = () => delete this.stack[key][registeredNumber];

        register();

        this.registeredIndex++;

        return {
            restore: register,
            unregister,
        }
    }

    applyMiddlewares(value: StateValue, key: StateKey) {
        this.state[key].middlewares?.forEach((middleware) => {
            value = cloneValue(middleware(value));
        });

        return value;
    }

    updateState<T>(key: StateKey, value: T): Promise<T> {
        return new Promise(async (res) => {
            if ('function' === typeof value) {
                const stateValue = this.state[key].state;

                const prevState = cloneValue(stateValue);

                value = value(prevState);

                return res(this.updateState(key, value));
            } else if (value instanceof Promise) {
                value = await value;

                return res(this.updateState(key, value));
            }

            value = this.applyMiddlewares(value, key);

            this.state[key].state = value;

            if (this.stack[key]) {
                Object.values(this.stack[key]).forEach((callback) => callback(value));
            }

            res(value);
        });
    }

    async runSequence<T>(key: StateKey, sequence: T[]) {
        for (const callback of sequence) {
            await this.updateState(key, callback);
        }
    }

    setState<T>(key: StateKey, value: T) {
        if (Array.isArray(value)) {
            this.runSequence<T>(key, value);
        } else {
            this.updateState<T>(key, value);
        }
    }

    use(key: StateKey) {
        const prop = this.state[key];

        if (!prop.hasOwnProperty('state')) {
            throw new Error(`Missing segment name: '${key}' in the segments config.`);
        }

        return {
            initialState: cloneValue(prop.state),
            actions: cloneValue(prop.actions),
            getState: () => cloneValue(prop.state),
            setState: <T>(value: T | ((prevState: T) => unknown) | (Promise<T>)) => this.setState(key, value),
            register: (callback: RegisteredCallback) => this.register(key, callback),
        };
    }

    constructor(config: Config, group: GroupName) {
        this.isInitialized = true;

        this.name = group;

        this.state = config;
    }
}