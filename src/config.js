export const config = {
    dataSources: {
        gap: {
            type: "ddfcsv",
            path: "https://raw.githubusercontent.com/open-numbers/ddf--gapminder--systema_globalis/develop"
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
            trails: {
                show: true,
                start: 1800
            },
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
            trails: {
                show: true,
                start: 1800
            },
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
                    which: "income_per_person_gdppercapita_ppp_inflation_adjusted",
                    dataSource: "gap",
                    scale: "log"
                },
                "y": {
                    type: "y",
                    which: "life_expectancy_years",
                    dataSource: "gap",
                    scale: "linear"
                },
                "size": {
                    type: "size",
                    which: "population_total",
                    dataSource: "gap",
                    scale: "sqrt",
                    range: [0, 50]
                        /*
                        space: ["geo", "time", "year"],
                        filter: {
                            age: "0"
                        }*/
                },
                "color": {
                    space: ["geo"],
                    type: "color",
                    which: "world_4region",
                    dataSource: "gap",
                    scale: "ordinal",
                    range: "schemeCategory10"
                },
                "frame": {
                    type: "frame",
                    which: "time",
                    value: 1800,
                    interpolate: true,
                    speed: 100
                }
            }
        }
    }
}