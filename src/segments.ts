import Group, { Config, ConfigData, StateKey, GroupName, Middleware } from './group';

interface Groups {
    [name: string]: Group;
}

interface PendingMiddlewares {
    [groupName: GroupName]: {
        [stateKey: StateKey]: Middleware[];
    },
}

export type { Config, ConfigData, StateKey, GroupName, Middleware };

export default class Segments {
    static groups: Groups = {};

    static pendingMiddlewares: PendingMiddlewares = {};

    static addMiddleware(key: StateKey, middleware: Middleware, group = 'default') {
        if (this.groups[group]) {
            return this.groups[group].addMiddleware(key, middleware);
        }

        if (!this.pendingMiddlewares[group]) {
            this.pendingMiddlewares[group] = {};
        }

        if (!this.pendingMiddlewares[group][key]) {
            this.pendingMiddlewares[group][key] = [];
        }

        this.pendingMiddlewares[group][key].push(middleware);

        return () => {
            console.log('The removal of the middleware should be here..');
        };
    }

    static addState(key: StateKey, value: ConfigData<any>, group = 'default') {
        if (this.groups[group].state.hasOwnProperty(key)) {
            throw new Error('Segment key is already exist, please use a different key.');
        }

        this.groups[group].state[key] = value;
    }

    static use(key: StateKey, group = 'default') {
        return this.groups[group].use(key);
    }

    static create(config: Config, group = 'default') {
        const groupPendingMiddlewares = this.pendingMiddlewares[group];

        if (groupPendingMiddlewares) {
            Object.keys(config).forEach((configKey) => {
                const configKeyPendingMiddlewares = groupPendingMiddlewares[configKey];

                if (configKeyPendingMiddlewares) {
                    if (!config[configKey].middlewares) {
                        config[configKey].middlewares = [];
                    }

                    config[configKey].middlewares = config[configKey].middlewares?.concat(configKeyPendingMiddlewares);

                    delete groupPendingMiddlewares[configKey];
                }
            });
        }

        this.groups[group] = new Group(config, group);

        return this.groups[group];
    }
}
