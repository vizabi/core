

# SCALE
# Definition

A scale is the part of the encoding which maps a value in the data to a value useful to a visualization. For example, mapping population to a bubble diameter in pixels, world region to a color in RGB hex or GDP per capita to an x-axis position in pixels. For more info on types of scales, see [d3-scale](https://github.com/d3/d3-scale).

### Configurable Properties:
- `scale.domain: Array<any>`: The domain of the scale. Defaults to the `encoding.data.domain` if encoding has data. If data is set to constant, defaults to `encoding.range` if it is set, or `data.constant` value if range not set.
- `scale.range: Array<any>`: The range of the scale. Defaults to `[0,1]` for standard scales. If data is constant, defaults to `encoding.domain` to create an identity scale.
- `scale.zeroBaseLine: boolean`: Forces the scale to have a 0 in domain for continuous scales with one sided domains (i.e. only positive or only negative domain values). Can be used for e.g. bar chart heights or bubble sizes, where domains [should include 0](https://flowingdata.com/2015/08/31/bar-chart-baselines-start-at-zero/).
- `scale.type: ordinal|point|band|linear|log|genericLog|sqrt|time`: The type of the scale. Defaults to first type in `scales` concept property, `ordinal` for entity, string and boolean concepts or single-value domains, `time` for time concepts and otherwise `linear`.
- `scale.orderDomain: boolean`: Orders discrete (`ordinal`, `band`, `point`) domains. Defaults to true.
- `scale.clampDomainToData: boolean`: Clamps configured domain to data domain. Defaults to false.
- `scale.clamp: boolean`: Makes continuous scale clamp input values to domain. Defaults to false. See [d3-scale](https://github.com/d3/d3-scale#continuous_clamp).
### Read only properties:
- `scale.d3Scale`: Returns a [d3-scale](https://github.com/d3/d3-scale) object, which you can further use in the visualization as `d3Scale(x)` or as `d3Scale.invert(px)`

