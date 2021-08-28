# FILTER
# Definition
A filter defines a selection of rows either through configuring the keys to single rows, or selecting key dimension (property) values, capturing multiple rows at once. 

# API reference
Write through `filter.config`, read through `filter`.

## Working with individual marker items
### Methods
Individual keys are stored in a map inside `filter.markers`

- `Boolean filter.any()`
- `Boolean filter.has(d | Array<d>)`
- `void filter.set(d | Array<d>)`
- `void filter.delete(d | Array<d>)`
- `void filter.toggle(d | Array<d>)`
- `void filter.clear()`

These are quite self-exlaining, but would be nice to give an example of these methods being used in a typical visualisation to implement highlight on hover and select on click interactions:

```js
autorun(() => {

  const selectedFilter = marker.encoding.selected.data.filter;
  const highlightFilter = marker.encoding.highlighted.data.filter;

  const selection = d3.selectAll("circle").data(marker.dataArray);

  selection.exit().remove();

  selection.enter().append("circle")
    .on("click", (event, d) => selectedFilter.toggle(d))
    .on("mouseover", (event, d) => highlightFilter.set(d))
    .on("mouseout", (event, d) => highlightFilter.delete(d));

  selection.update()
    .style("opacity", d => {
      if (highlightFilter.has(d)) return OPACITY_HIGHLIGHTED;
      if (selectedFilter.has(d)) return OPACITY_SELECTED;
      if (highlightFilter.any() || selectedFilter.any()) return OPACITY_DIMMED;
      return OPACITY_REGULAR;      
    })
}
```

![FTqmz1PwxH](https://user-images.githubusercontent.com/3648190/125066404-41a48180-e0b3-11eb-9311-bbbecef4a682.gif)

code to reproduce the above gif:

```js
// on tools page bar rank chart: https://www.gapminder.org/tools/#$chart-type=barrank&url=v1 paste this in JS console
mobx.autorun(()=>{
  slt = viz.model.markers.bar.encoding.selected.data.filter;
  hlt = viz.model.markers.bar.encoding.highlighted.data.filter;
  console.log("select filter.markers", js(slt.config.markers), "highlight filter.markers", js(hlt.config.markers));
})
```


## Working with slices of marker items 

```js
//filter by individual entities (such as we do in line chart and pop by age)
filter.config.dimensions = {
    country: {
        country: {$in: ["usa", "chn", "rus", "nga"]}
    }
}
```

![image](https://user-images.githubusercontent.com/3648190/125064342-d8bc0a00-e0b0-11eb-9a09-cbf88fd7ee2c.png)


```js
//filter by a criteria on multiple dimensions (this is implicitly turned into an `$and`)
filter.config.dimensions.age = {
    geo: {
        geo: {$in: ["world"]}
    }
    age: {$gt: 30}
}
```
![image](https://user-images.githubusercontent.com/3648190/125063121-64349b80-e0af-11eb-9f37-85467dea9ba4.png)

```js
//filter by dimensions property
filter.config.dimensions = {
    country: {
        income_groups: {$in: ["low_income"]}
    }
}

```
![image](https://user-images.githubusercontent.com/3648190/125064015-79f69080-e0b0-11eb-8e2a-add2b043da0c.png)

```js
//filter by multiple dimensions properties
filter.config.dimensions = {
    country: {
        income_groups: {$in: ["low_income"]},
        world_4region: {$in: ["asia"]}        
    }
}

```
![image](https://user-images.githubusercontent.com/3648190/125064277-c5a93a00-e0b0-11eb-8442-071af7eb6bb3.png)





## Working with encoding's extra dimensions
Sometimes you want encoding dimensionality to be higher than marker dimensionality, that is to say, you want `encoding.data.space` to be a proper superset of `marker.data.space`. In this case you must restrict each complementing dimension of the encoding in order to avoid ambiguity of joining the data.

Imagine you set Y of the bubbles to concept `literacy_rate` by `[country, gender, time]` while marker space is still the regular `[country, time]`. The dimension `gender` must be then set to constant, because in `[country, gender, time]` table there are two rows, one for each gender, satisfying the `[country, time]` key.

Use `encoding.data.filter` to set the complementing dimensions to constant

```js
filter.config.dimensions = {
    gender: {
        gender: "male"
    }
}
```

Do the same for the female literacy rate on X encoding and you will have made a chart where each bubble is a `[country, time]` marker item, but X and Y show `[country, gender, time]` data

![image](https://user-images.githubusercontent.com/3648190/125062691-f8523300-e0ae-11eb-8b2d-96af285288e8.png)

