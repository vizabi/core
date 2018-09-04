# Filters

A filter limits the space of the markers, i.e. it limits which markers will be shown in the visualization if there's sufficient data for them. It does this by defining constraints on the keys and/or values of the marker's data. It's function is very similar to an SQL `where` clause or mongoDB query selectors.

The simplest filter would be one `filter` field containing a DDFQL `where` clause like:

```json
data: {
	space: ["geo", "year", "gender"],
    filter: {
    	"$or": [
            { "geo": { "$in": ["usa", "chn"] } },
            { "population": { "$lte": 1000000 } }
    	],
        "year" : { "gte": 2000 },
        "gender": "male"
    }
}
```

## Problem: One unrestricted filter field

An unrestricted filter field is very expressive but can create problems exactly because of the expressiveness.

### Human editing

Configuring the filter field by hand might be hard if you don't fully understand DDFQL `where` syntax. Larger filter expressions can also become quite complex to parse (for a humand mind).

### GUI editing

A GUI should be drawn using data in the filter and should change the filter upon changes. The logic parsing the filter field can be quite complex if not infeasible. Instead, there could be "intermediate" fields which are less expressive but make GUI editing easier.

The main GUI would be the Show GUI in which you choose which markers to show and which not. Preferably, you can choose to show specific markers or show markers by dimension values. For example, all male bubbles, all Germany bubbles or specifically the Germany male bubble and the Sweden female bubble.

For example

```
marker: {
    data: {
        show: {
            markers: [
            	{ geo: "usa", gender: "male" }, 
            	{ geo: "swe", gender: "female" }
            ],
            dimensions: {
                geo: ["usa", "swe"],
                gender: ["male"]
            }
        }
    }
}
```

which would lead to the filter

```
{
    $or: [
        {
            $or: [
                {
                    geo: "usa",
                    gender: "male"
                },
                {
                    geo: "swe",
                    gender: "female"
                }
            ]
        },
        {
            $and: [
                {
                    geo: { $in: ["usa","swe"] },
                    gender: { $in: ["male"] }
                }
            ]
        }
    ]
}
```



## Problem: Subspace queries return unused data

A marker filter as defined above reduces the markers shown in the visualization. Queries for marker-amending data should only include rows applicable to defined markers. For example, getting the `world_4region` of countries, should only return countries for which there are markers. If a certain country is not included in the marker data because of a marker filter (e.g. `year > 2000` and country only has data for `year <= 2000`), no need to get the `world_4region` of that country.

This would reduce the amount of unused data transferred and the amount of data needed to be processed by Vizabi.

### Optimal response size

To get an optimal result there are three ways:

- Request all marker data at once, in one query. 

   \+ Smaller responses with only relevant data (if response is normalized per table and joined in Vizabi).

   \- Requires redesign of DDFQL so we can `select` data from joined tables. Now we can just filter (`where`) using joined tables.

```
{
    select: { 
    	key: *,
    	value: ["dps.life_expectancy","dps.population","geo.world_4region"]
    },
    from: {
        dps: ["geo","gender","year"],
        geo: ["geo"]
    },
    where: {
        "$or": [
            { "geo": { "$in": ["usa", "chn"] } },
            { "dps.population": { "$lte": 1000000 } }
        ],
        "year" : { "gte": 2000 },
        "gender": "male"
    }
}
```

_Example of possible future DDFQL query with which allows selecting from joined table. Probably contains flaws._

- Add a subquery which executes the full datapoint query for the marker and returns the distinct subspaces (e.g. `geo`'s) in the datapoint result. Probably through a `where` and `join`. 
   \+ Smaller responses with only relevant data
   \- Requires redesign of DDFQL (implementations) so we can `join` a super-space table (e.g. `geo,time` on `geo`).
   \- Inefficient as the costly datapoint query is repeated for each smaller query.

```json
{
    select: { 
    	key: ["geo"],
    	value: ["world_4region"]
    },
    where: {
        geo: "$geo"
    },
    join: {
        $geo: {
            key: ["geo","gender","year"],
            where: {
                "$or": [
                    { "geo": { "$in": ["usa", "chn"] } },
                    { "population": { "$lte": 1000000 } }
                ],
                "year" : { "gte": 2000 },
                "gender": "male"
            }
        }
    }
}
```
_Example of a DDFQL query which joins a superspace on a subspace. Currently not implemented in any reader._

- Build marker data step by step

   1. Query marker space encodings and build marker data with them. 
   2. Filter marker data so all important encodings have data. 
   3. Query important encodings using marker subspaces using the remaining markers as filter.
   4. Filter marker data so all important encodings have data. 
   5. Query the remaining encodings using the remaining markers as filter.

   \+ Smaller responses with only relevant data

   \- requires 3 sequential query "batches" which increases load time and load logic complexity 

   \- requires more complex queries with additional filters on keys

### Suboptimal (but smaller) response size

The optimal results require either redesigning DDFQL or more loading complexity and time. Maybe a suboptimal result would still be more efficient but require less tradeoffs. We can analyze the marker filter to deduce encoding filters which apply to the encoding space which will result in less irrelevant data but not necessarily no irrelevant data. 

Filters are Boolean expressions consisting of one or more comparison expressions combined with logical operators. These comparison expressions consist of a field, a comparison operator and a primitive value to which the field is compared.

```json
world_4region: { $eq: "europe" }
population: { $lte: 10000000 }
```

_comparison expressions with using the `$eq` and `$lte` comparison operators_

```
$and: [
    { "geo.world_4region": { $eq: "europe" } },
    { $or: [
		{ population: { $lte: 10000000 } },
		{ gender: { $eq: "male" } }
    ] }
]
```

_filter expression with logical operators (`$and`, `$or`) and comparison operators_

The marker filter expressions can be reused in the encoding filter to limit the data returned by the encoding. 

#### Comparison expression reuse for marker space encodings

If the encoding space is identical to the marker space, the whole filter can be reused. Every marker filter expressions applies to the encoding data. 

#### Comparison expression reuse for subspace encodings

If the encoding space is a subspace of the marker space, only comparison expressions using fields in the overlapping space can be used. Furthermore, which of those comparison expressions can be used depends  on what logical operator applies to it.

```json
marker: {
	data: { 
        space: ["geo","year"],
        filter: {
        	geo: { $in: ["swe", "usa"] },
            year: { $gte: "2000" }
    	}
    },
	encoding: { 
		color: { data: { 
        	concept: "world_4region",
            space: ["geo"] 
        } } 
	}
}
```

In the above filter, `geo: { ... }` is a comparison operator, joined by an (implicit) `$and` operator.

If the comparison expression is joined by an `$and` operator, other comparison expression in the `$and` expression will only further limit the amount of rows returned by the query. This means that copying a comparison expression from an `$and` expression to an subspace encoding will always return sufficient rows. If other expressions in the `$and` statement further limit the amount of markers, the encoding data might still contain irrelevant rows, which is suboptimal but acceptable.

    filter: {
        "$and": [    
           	{ geo: { $in: ["swe", "usa"] } },
            { year: { $gte: "2000" } }
       	]
    }
If the comparison expression is joined by an `$or` expression, other comparison expressions in the `$or` expression can broaden the amount of rows returned by the query. This means that copying a comparison expression from an `$or` expression in the marker filter to a subspace encoding filter might make it too strict. The encoding data might miss rows which are included in the marker data. Only when all expressions in the `$or` statement can be copied to the encoding filter, we can be sure that no rows will be missing.

In other words, if all of the sub-expressions in the `$or` expression contain a filter on `geo`, you can copy the `$or` expression in your encoding filter with only the `geo` expressions. However, if one or more of them doesn't contain a `geo` filter, any `geo` could be returned by the complete filter and thus you can't copy the `$or` to your encoding filter.

    filter: { 
        "$or": [
           	{ geo: { $in: ["swe", "usa"] } },
            { year: { $gte: "2000" } }
        ]
    }
Given the following dataset:

| geo  | year | population |
| ---- | ---- | ---------- |
| swe  | 2017 | 1000       |
| usa  | 1988 | 100000000  |
| swe  | 2016 | 10000      |
| ukr  | 1990 | 1000       |

| geo  | world_4region |
| ---- | ------------- |
| swe  | europe        |
| usa  | americas      |
| ukr  | europe        |

The marker data with the `$and` filter would be:

| geo  | year | color  |
| ---- | ---- | ------ |
| swe  | 2017 | europe |
| swe  | 1988 | europe |

The color encoding filter would be (the geo-part of the $and-expression): 

```
{ 
	"$and": [
        { geo: { $in: ["swe", "usa"] } }
	]
}
```

The color encoding data would be:

| geo  | world_4region |
| ---- | ------------- |
| swe  | europe        |
| usa  | americas      |

The color encoding data contains sufficient data to apply color encoding to the marker. It contains irrelevant data on the `world_4region` of `usa`, since `usa` is not in the marker data. It's not in the marker data because of the filter on `year` . `usa` is in the color data because the `year ` and `population` filters could not be applied to the `geo` entity set (without a "fully optimizing" but costly datapoint subquery).

The marker data with the `$or` filter would be: 

| geo  | year | population |
| ---- | ---- | ---------- |
| swe  | 2017 | 1000       |
| usa  | 1988 | 100000000  |
| swe  | 2016 | 10000      |

The color encoding filter would be empty (`{}`) since one of the `$or` operands does not contain `geo` and thus a we cannot copy the `$or` to the encoding filter.

The color encoding data would be:

| geo  | world_4region |
| ---- | ------------- |
| swe  | europe        |
| usa  | americas      |
| ukr  | europe        |

The color encoding data contains sufficient data to apply color encoding to the marker. It contains irrelevant data on the `world_4region` of `ukr`, since `ukr` is not in the marker data. It's not in the marker data because of the filter on `year` . `ukr` is in the color data because the `geo` filter could not be applied to the `geo` entity set since it is in an `$or` statement. Other expressions in the `$or` statement could've made `ukr` show up in the marker data, e.g. `year: { $gte: 1900 }`.

### Maybe no need for these optimizations

It's good to limit the amount of data returned, especially if the tradeoff isn't big. However, often these subspaces are specific entity sets or domains and Vizabi will query the full domain or set anyway. For example to fill a `show` GUI with all possible values of entity sets in the marker space. Using the same filter as the query for that data, makes it possible to join queries resulting in one request/response to handle. More data but less requests. It's a tradeoff.

## $or statements and subspace queries

Another very frequent use of `$or` statements is for only showing specific markers:

```json
space: ["geo", "gender","year"]
filter: {
    $or: [
        { geo: "usa", gender: "male" }
        { geo: "swe", gender: "female" }
    ]
}
```

### Per concept filter

Have separate filters per concept, which are in the background joined with into an `$and` statement. This does not allow for selecting specific markers, so you'd need another configuration to select specific markers. 

Removes expressiveness of or-statements that contain multiple concepts (which is needed for marker-specific filtering). Does allow for expressiveness of or-statements within one concept.

```json
conceptFilters: {
    geo: {
        $or: [
            { geo: { $in: ["chn", "usa"] } },
            { geo.world_4region: "europe" }
        ]
    },
    gender: {
        gender: "male"
    },
    year: {
        year: { "$gte": 2000 }
    },
    population: {
        population: { $lte: 1000000 }
    }
}
```
