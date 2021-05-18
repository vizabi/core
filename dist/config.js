const config = {
    dataSources: {
        /*gapcsv: {
            type: "ddfcsv",
            path: "https://raw.githubusercontent.com/open-numbers/ddf--gapminder--systema_globalis/develop"
        },
        gapbw: {
            modelType: "bw",
            service: 'https://big-waffle.gapminder.org', 
            name: "sg-master"
        },
        */
        gap: {
            modelType: "ddfcsv",
            path: "./ddf--jheeffer--mdtest/"
        },
        
        /*
                sg: {
                    type: "ddfcsv",
                    path: "./systema_globalis/"
                },*/
        /*
        pcbs: {
            type: "ddfcsv",
            path: "./ddf--pcbs--census2017/"
        },
        gapcsv: {
            type: "csv",
            file: "fullgap.gapodd.csv",
            space: ["geo", "time"],
            transforms: [{
                type: "interpolate",
                dimension: "time",
                step: 1,
                concepts: ["POP", "GDP", "LEX", "world_region"],
            }]
        },
        soder: {
            reader: "csv",
            path: "soder.csv"
        }
        */
    },
    markers: {
        /*
        "pcbs": {
            type: "bubble",
            space: ["region", "year", "locality_type"],
            encoding: {
                // "markerProperty": "encoding definition"
                "x": {
                    type: "x",
                    which: "wealth_index_mean",
                    dataSource: "pcbs",
                    scale: "linear"
                },
                "y": {
                    type: "y",
                    which: "average_household_size",
                    dataSource: "pcbs",
                    scale: "linear"
                },
                "size": {
                    type: "size",
                    which: "total_population",
                    scale: "sqrt",
                    dataSource: "pcbs",
                    space: ["region", "year", "locality_type", "gender", "age"],
                    filter: {
                        age: "all_ages",
                        gender: "both_sexes"
                    }
                },
                "color": {
                    space: ["region"],
                    type: "color",
                    which: "region",
                    dataSource: "pcbs",
                    scale: "ordinal"
                },
                "frame": {
                    type: "frame",
                    which: "year",
                    value: 2017,
                    interpolate: true,
                    speed: 100
                }
            }
        },
        */
        bubble: {
            requiredEncodings: ["x", "y", "size"],
            data: { 
              source: "gap",
              filter: {},
              space: ["country", "time"]
            },
            encoding: {
              "selected": {
                modelType: "selection",
                data: {
                  filter: {
                    ref: "markers.bubble.encoding.trail.data.filter"
                  }
                }
              },
              "highlighted": { modelType: "selection" },
              "superhighlighted": { modelType: "selection" },
              "y": {
                data: {
                  concept: "life_expectancy"
                }
              },
              "x": {
                data: {
                  concept: "income_per_person_gdppercapita_ppp_inflation_adjusted"
                }
              },
              "order": { 
                modelType: "order",
                data: { 
                  constant: {
                    ref: "markers.bubble.encoding.size.data.constant"
                  },
                  concept: {
                    ref: "markers.bubble.encoding.size.data.concept"
                  } 
                }
              },
              "size": {
                data: {
                    concept: "population_total"
                },
                scale: {
                  modelType: "size",
                  range: [0, 50]
                }
              },
              "color": { 
                data: {
                    space: ["country", "time"],
                    concept: "life_expectancy"
                  },
                  scale: { modelType: "color" } 
                },
              "label": { data: { modelType: "entityPropertyDataConfig" } },
              "frame": { modelType: "frame", value: "2016" },
              "trail": { modelType: "trail" }
            }
        },
        "legend": {
            data: {
                ref: {
                    transform: "entityConcept",
                    model: "markers.bubble.encoding.color"
                }
            },
            encoding: {
                color: {
                    data: { concept: { ref: "markers.bubble.encoding.color.data.concept" } },
                    scale: { ref: "markers.bubble.encoding.color.scale" }
                },
                name: { data: { concept: "name" } },
                rank: { data: { concept: "rank" } },
                map: { data: { concept: "shape_lores_svg" } }
            }
        },
        "bubble-noconfig": {
            requiredEncodings: ["x", "y", "size"],
            data: { source: "gapbw" },
            encoding: {
                "selected": {
                    modelType: "selection",
                    data: { 
                        filter: { 
                            ref: "markers.bubble.encoding.trail.data.filter"
                        }
                    }
                },
                "highlighted": { modelType: "selection" },
                "superhighlighted": { modelType: "selection" },
                "x": { },
                "y": { },
                "order": { 
                    modelType: "order",
                    data: { 
                      constant: {
                        ref: "markers.bubble.encoding.size.data.constant"
                      },
                      concept: { 
                        ref: "markers.bubble.encoding.size.data.concept"
                      } 
                    }
                },
                "size": {
                    scale: {
                        modelType: 'size',
                        range: [0, 50]
                    }
                },
                "color": { scale: { modelType: "color" } },
                "label": { data: { modelType: "entityPropertyDataConfig" } },
                "frame": { modelType: "frame" },
                "trail": { modelType: "trail" }                
            }
        },
        "bubble-sg": {
            data: {
                source: "gapbw",
                space: ["country", "time"],
                filter: {
                    dimensions: {
                        "country": {
                            "un_state": true
                        }
                    }
                }
                /*filter: {
                    markers: {},
                    dimensions: {
                        geo: {
                            "geo.world_4region": "europe"
                        },
                        time: {
                            "time": { "$gte": 2000 }
                        }
                    }
                }*/
            },
            requiredEncodings: ["x", "y", "size"],
            encoding: {
                "selected": {
                    modelType: "selection",
                    data: { 
                        filter: { 
                            ref: "markers.bubble.encoding.trail.data.filter"
                        }
                    } // ref:  }
                },
                "highlighted": {
                    modelType: "selection",
                    data: { }
                },
                "superhighlighted": {
                    modelType: "selection",
                    data: { } 
                },
                "x": {
                    data: {
                        concept: "income_per_person_gdppercapita_ppp_inflation_adjusted"
                    },
                    scale: {
                        type: "log"
                    }
                },
                "y": {
                    data: {
                        concept: 'life_expectancy_years', // concept: "life_expectancy",
                        /*space: ['country', 'time'], //["country", "gender", "time"],
                        filter: {
                            dimensions: {
                                gender: { gender: "male" }
                            }
                        }*/
                    },
                    scale: {
                        type: "linear",
                       // domain: [50, 60]
                    }
                },
                "order": {
                    modelType: "order",
                    data: {
                        constant: {
                            ref: "markers.bubble.encoding.size.data.constant"
                        },
                        concept: { 
                            ref: "markers.bubble.encoding.size.data.concept"
                        },
                        direction: "desc"
                    }
                },
                "size": {
                    data: {
                        concept: "population_total"
                    },
                    scale: {
                        modelType: "size",
                        range: [0, 50]
                    }
                },
                "color": {
                    data: {
                        space: ["country"],
                        concept: "world_4region"
                    },
                    scale: {
                        modelType: 'color',
                        type: "ordinal"
                    }
                },
                "label": {
                    data: {
                        modelType: "entityPropertyDataConfig",
                        concept: "name"
                    }
                },
                "frame": {
                    modelType: "frame",
                    data: {
                        concept: "time"
                    },
                    splash: true,
                    value: "2018",
                    interpolate: true,
                    extrapolate: "fill",
                    speed: 100
                },
                "trail": {
                    modelType: "trail",
                    groupDim: "time"
                }
            }
        }
    }
}