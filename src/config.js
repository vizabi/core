export const config = {
    dataSources: {
        gapcsv: {
            type: "ddfcsv",
            path: "https://raw.githubusercontent.com/open-numbers/ddf--gapminder--systema_globalis/develop"
        },
        gap: {
            type: "waffle",
            "path": "https://waffle-server.gapminder.org/api/ddf/ql",
            "assetsPath": "https://import-waffle-server.gapminder.org/api/ddf/assets/"
        },
        pcbs: {
            type: "ddfcsv",
            path: "./ddf--pcbs--census2017/"
        },
        gapcsv: {
            type: "csv",
            file: "fullgap.gapodd.csv",
            space: ["geo", "time"],
            /*transforms: [{
                type: "interpolate",
                dimension: "time",
                step: 1,
                concepts: ["POP", "GDP", "LEX", "world_region"],
            }]*/
        },
        soder: {
            reader: "csv",
            path: "soder.csv"
        }
    },
    markers: {
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
                    scale: "ordinal",
                    range: "schemeCategory10"
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
        "bubble": {
            type: "bubble",
            space: ["geo", "time"],
            encoding: {
                // "markerProperty": "encoding definition"
                /*"label": {
                    type: "label",
                    which: "name",
                    space: [
                        ["geo"],
                        ["gender"]
                    ],
                    scale: "concat"
                },*/
                "selected": {
                    type: "selection",
                    markers: ["geo-usa"]
                },
                "highlighted": {
                    type: "selection"
                },
                "superhighlighted": {
                    type: "selection"
                },
                "x": {
                    type: "x",
                    data: {
                        source: "gap",
                        concept: "income_per_person_gdppercapita_ppp_inflation_adjusted"
                    },
                    scale: {
                        type: "log"
                    }
                },
                "y": {
                    type: "y",
                    data: {
                        source: "gap",
                        concept: "life_expectancy_years"
                    },
                    scale: {
                        type: "linear"
                    }
                },
                "order": {
                    type: "order",
                    data: [
                        { ref: "marker.bubble.encoding.size.data", direction: "descending" }
                    ]
                },
                "size": {
                    type: "size",
                    data: {
                        source: "gap",
                        concept: "population_total"
                    },
                    scale: {
                        type: "sqrt",
                        range: [0, 50]
                    }
                    /*
                    space: ["geo", "time", "year"],
                    filter: {
                        age: "0"
                    }*/
                },
                "color": {
                    type: "color",
                    data: {
                        source: "gap",
                        space: ["geo"],
                        concept: "world_4region"
                    },
                    scale: {
                        type: "ordinal",
                        range: "schemeCategory10"
                    }
                },
                "frame": {
                    type: "frame",
                    data: {
                        concept: "time"
                    },
                    value: 2018,
                    interpolate: true,
                    speed: 100,
                    trails: {
                        show: true,
                        start: 1800,
                        markers: { ref: "marker.bubble.encoding.selected.markers" }
                    }
                }
            }
        }
    }
}