export const config = {
    dataSource: {
        /*gapcsv: {
            type: "ddfcsv",
            path: "https://raw.githubusercontent.com/open-numbers/ddf--gapminder--systema_globalis/develop"
        },*/
        /*gap: {
            type: "waffle",
            "path": "https://waffle-server.gapminder.org/api/ddf/ql",
            "assetsPath": "https://import-waffle-server.gapminder.org/api/ddf/assets/"
        },*/
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
    marker: {
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
        "legend": {
            data: {
                ref: {
                    transform: "entityConcept",
                    model: "marker.bubble.encoding.color"
                }
            },
            encoding: {
                color: {
                    data: { concept: { ref: "marker.bubble.encoding.color.data.concept" } },
                    scale: { ref: "marker.bubble.encoding.color.scale" }
                },
                name: { data: { concept: "name" } },
                rank: { data: { concept: "rank" } },
                map: { data: { concept: "shape_lores_svg" } }
            },
        },
        "bubble": {
            modelType: "bubble",
            data: {
                source: "gap",
                space: ["geo", "time"],
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
            encoding: {
                "selected": {
                    modelType: "selection",
                    data: { ref: "marker.bubble.encoding.frame.trail.data" }
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
                        concept: "life_expectancy",
                        space: ["geo", "gender", "time"]
                    },
                    scale: {
                        type: "linear"
                    }
                },
                "order": {
                    modelType: "order",
                    data: {
                        ref: "marker.bubble.encoding.size.data",
                        direction: "descending"
                    }
                },
                "size": {
                    modelType: "size",
                    data: {
                        concept: "population_total"
                    },
                    scale: {
                        type: "sqrt",
                        range: [0, 50]
                    }
                },
                "color": {
                    data: {
                        space: ["geo"],
                        concept: "world_4region"
                    },
                    scale: {
                        type: "ordinal"
                    }
                },
                "label": {
                    modelType: "label",
                    data: {
                        concept: "name"
                    }
                },
                "frame": {
                    modelType: "frame",
                    data: {
                        concept: "time"
                    },
                    value: 2018,
                    interpolate: true,
                    speed: 100,
                    trail: {
                        show: true,
                        starts: {},
                        data: {
                            filter: {
                                markers: {}
                            }
                        }
                    }
                }
            }
        }
    }
}