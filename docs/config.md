# Config object

```js
cfgSet = Vizabi.configSet({}, pageConfig);
marker = Vizabi.marker(cfgSet);

marker(cfgSet) {
    cfgSet.append(defaultConfig);
    cfg = cfgSet.resolvedConfig;

    data {
        return data(cfg.data)
    }
}

usercfg = cfgSet.configs[0];
 
cfgSet(...configs) {
    return { 
        get resolvedConfig() {
            configs
        },
        get(property) {
            const children = configs.map(cfg => cfg[property]);
            Vizabi.configSet(...children)
        }
    }
}


```

# functional

```js
config = { ... }
marker = Vizabi.marker(config)

marker(config) {
    resolved = applyDefaults(config, defaults);
}

```


