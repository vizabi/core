# FILTER
# Definition
A filter defines a selection of rows either through configuring the keys to single rows, or selecting key dimension (property) values, capturing multiple rows at once. 

# API reference
## Working with individual marker items
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

## Working with slices of marker items 

```js
//filter by individual entities (such as we do in line chart and pop by age)
filter.config.dimensions = {
    country: {
        country: {$in: ["aus", "blr", "bfa", "chl", "chn"]}
    }
}

//filter by a criteria on multiple dimensions
filter.config.dimensions.age = {
    geo: {
        geo: {$in: ["world"]}
    }
    age: {$gt: 30}
}


//filter by entity set criteria
filter.config.dimensions = {
    country: {
        income_groups: {$in: ["low_income"]}
    }
}

```

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

  const selectedFilter = marker.encoding.selected.data.filter;
