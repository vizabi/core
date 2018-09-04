import { autorun, action, spy, observable } from 'mobx'
import { vizabi } from './vizabi'
import { config } from './config'
import appState from './appState'
import { fromPromise } from 'mobx-utils';
import { isEntityConcept, fromPromiseAll, arrayEquals, relativeComplement } from './utils';

var ddfcsv = new DDFCsvReader.getDDFCsvReaderObject();
var waffle = new WsReader.WsReader.getReader();
vizabi.stores.dataSource.createAndAddType('ddfcsv', ddfcsv);
vizabi.stores.dataSource.createAndAddType('waffle', waffle);
window.viz = vizabi(config);
window.vizabi = vizabi;
window.autorun = autorun;

autorun(() => {
    d3.select("#right pre").html(JSON.stringify(vizabi.config, null, 2))
}, { name: "showcfg" })


//spy((event) => {
//    console.log(`${event.name}`, event)
//})
/*
spy((event) => {
    if (event.type === 'action') {
        console.log(`${event.name} with args: `, event, event.arguments)
    }
})
*/

//autorun(chart);
chart();

function chart() {

    const marker = viz.stores.marker.get("bubble");
    const legendmarker = viz.stores.marker.get("legend");

    var xAxis = d3.axisBottom();
    var yAxis = d3.axisLeft();

    var chart = d3.select("#chart"); //.html("");
    var svg = chart.append("g");
    var xAxisSVG = svg.append("g")
        .attr("class", "x axis");
    var xAxisSVGtext = xAxisSVG
        .append("text")
        .attr("class", "label")
        .attr("y", -6)
        .style("text-anchor", "end");
    var yAxisSVG = svg.append("g")
        .attr("class", "y axis");
    var yAxisSVGtext = yAxisSVG.append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end");
    var bubbles = svg.append("g")
        .attr("class", "bubbles");
    var labels = svg.append("g")
        .attr("class", "labels");


    const spaceSel = d3.select('#encodingcontrol')
        .append('select')
        .attr('id', 'spaceSel');


    let playtoggle, timeslider, speedslider;

    function setupTimecontrol() {

        const frameCfg = marker.encoding.get("frame");

        const timecontrol = d3.select("#timecontrol");
        playtoggle = timecontrol.select("#toggle")
            .on('click', function() { frameCfg.togglePlaying() })
        timeslider = timecontrol.select("#timeslider")
            .on('input', function() { frameCfg.setValueAndStop(this.value) });
        speedslider = timecontrol.select("#speedslider")
            .attr('min', 1)
            .attr('max', 1000)
            .style('direction', 'rtl')
            .on('input', function() { frameCfg.setSpeed(this.value) });
    }

    function start(marker, caseImpl) {
        marker.dataPromise.case(caseImpl);
    }
    /*
        if (!Array.isArray(markers)) markers = [markers];
        const dataPromises = [];
        markers.forEach(marker => {
            marker.availabilityPromise.case({
                fulfilled: () => {
                    marker.conceptsPromise.case({
                        fulfilled: () => {
                            dataPromises.push(marker.dataPromise);
                        }
                    })
                }
            })
        })
        if (dataPromises.length == markers.length) {
            if (dataPromises.some(p => p.state == "rejeted")) rejected();
            else if (dataPromises.every(p => p.state == "fulfilled")) fulfilled();
            else pending();
        }
    }
    */
    const updateSize = action("wrapper size", function(e) {
        var wrap = document.getElementById("wrapper");
        appState.wrapper.height = wrap.clientHeight;
        appState.wrapper.width = wrap.clientWidth;
    });
    window.addEventListener("resize", updateSize);
    updateSize();

    autorun(setupTimecontrol);
    autorun(drawBubbles);
    autorun(drawChart);
    autorun(drawLegend);
    autorun(drawTimecontrol);
    autorun(drawEncoding);
    //drawBubbles();
    //drawChart();
    //drawLegend();

    let zoomScales;
    setupZoom();

    function setupZoom() {

        const xConfig = marker.encoding.get("x");
        const yConfig = marker.encoding.get("y");

        var zoom = d3.zoom()
            //.scaleExtent([.1, 20])
            .on("zoom", zoomed);

        chart.call(zoom);

        zoomScales = observable({
            t: d3.zoomTransform(chart),
            get x() { return this.t.rescaleX(xConfig.d3Scale) },
            get y() { return this.t.rescaleY(yConfig.d3Scale) },
            setTransform: action(function(t) {
                this.t = t
            })
        });

        function zoomed() {
            zoomScales.setTransform(d3.event.transform);
        }
    }

    function drawTimecontrol() {

        start(marker, {
            pending: showLoading,
            rejected: showError,
            fulfilled: draw
        });

        function showLoading() {
            console.log("loading");
        }

        function showError(error) {
            console.warn("error", error);
        }

        function draw() {
            const frameCfg = marker.encoding.get("frame");
            const [min, max] = frameCfg.scale.domain || [0, 1];
            d3.select("#timecontrol").select('.frameval').text(frameCfg.value);
            timeslider.attr('min', min)
                .attr('max', max)
                .property('value', frameCfg.value)
                .attr('step', 1);

            speedslider.property('value', frameCfg.speed);

            playtoggle.property('value', frameCfg.playing ? 'stop' : 'play')
        }
    }

    function drawBubbles() {
        start(marker, {
            pending: showLoading,
            rejected: showError,
            fulfilled: showData
        });

        function showLoading() {
            console.log("loading");
        }

        function showError(error) {
            console.warn("error", error);
        }

        function showData() {
            const data = marker.dataArray;
            const sizeConfig = marker.encoding.get("size");
            const colorConfig = marker.encoding.get("color");
            const xConfig = marker.encoding.get("x");
            const yConfig = marker.encoding.get("y");
            const frameConfig = marker.encoding.get("frame");
            const selectedConfig = marker.encoding.get("selected");
            const highlightConfig = marker.encoding.get("highlighted");
            const superHighlight = marker.encoding.get("superhighlighted");

            const labelWithoutFrame = (d) => marker.data.space.filter(dim => frameConfig.data.concept != dim).map(dim => d.label[dim]).join(', ')
            const labelAll = (d) => marker.data.space.map(dim => d.label[dim]).join(', ');
            const labelOnlyFrame = (d) => d[frameConfig.data.concept];

            // data join
            let update = bubbles.selectAll(".dot")
                .data(
                    data,
                    d => d[Symbol.for('key')]
                );

            // create new bubbles
            const enter = update.enter()
                .append("circle")
                .attr("class", "dot")
                .attr("id", d => d[Symbol.for('key')])
                .on("click", d => {
                    if (!d[Symbol.for('trailHeadKey')]) marker.toggleSelection(d);
                })
                .on("mouseover", d => highlightConfig.data.filter.set(d))
                .on("mouseout", d => highlightConfig.data.filter.delete(d));

            // remove old bubbles
            const exit = update.exit().remove();

            // create or stop transition of update selection
            update = (frameConfig && frameConfig.playing) ?
                update.transition(getTransition(frameConfig)) :
                update.interrupt();

            // update bubble properties
            // can't use merge as you can't merge transitions and selections without losing transition
            labels.selectAll("*").remove();
            [enter, update].map(selection => {
                selection.attr("cx", function(d) {
                        return zoomScales.x(d.x);
                    })
                    .attr("cy", function(d) {
                        return zoomScales.y(d.y);
                    })
                    .style("fill", function(d) {
                        return colorConfig.d3Scale(d.color);
                    })
                    .style('animation', d => {
                        return superHighlight.data.filter.has(d) ?
                            'blink 1s step-start 0s infinite' :
                            'none';
                    })
                    .style('stroke', 'black')
                    .style('stroke-width', d => isHighlightedTrail(d) ? 3 : 1)
                    .style('stroke-opacity', getOpacity)
                    .style('opacity', getOpacity)
                    .attr("r", d => {
                        const which = sizeConfig.which;
                        const radius = isNaN(which) ? sizeConfig.d3Scale(d.size) : which;
                        return radius;
                    })
                    .each(drawLabel);

            })

            // sort bubbles in data order
            bubbles.selectAll(".dot").order();

            function getOpacity(d) {
                const highlightOthers = 0.3;
                const selectOthers = 0.5;
                const regular = 0.8;
                const full = 1;
                const highlighted = highlightConfig.data.filter.has(d);
                const selected = selectedConfig.data.filter.has(d);
                const trail = d[Symbol.for('trailHeadKey')];

                if (highlighted || selected) return full;
                if (trail) return regular;
                if (selectedConfig.any) return selectOthers;
                if (highlightConfig.any) return highlightOthers;
                return regular;
            }

            function isHighlightedTrail(d) {
                const key = d[Symbol.for('trailHeadKey')] || d[Symbol.for('key')];
                return selectedConfig.data.filter.has(key) && highlightConfig.data.filter.has(d)
            }


            function drawLabel(d) {
                let labelStr;

                // if trail, put label at trail start
                const key = d[Symbol.for('trailHeadKey')] || d[Symbol.for('key')];
                if (frameConfig.trail.data.filter.has(key)) {
                    if (frameConfig.trail.show) {
                        const trailStart = frameConfig.trail.starts[key];
                        // if this bubble is trail start bubble
                        if (trailStart == d[frameConfig.data.concept])
                            labelStr = labelAll(d);
                        else if (highlightConfig.data.filter.has(d)) {
                            labelStr = labelOnlyFrame(d);
                        }
                    } else {
                        labelStr = labelWithoutFrame(d);
                    }
                }

                // if highlight, put on highlight =)
                else if (highlightConfig.data.filter.has(d)) {
                    labelStr = labelWithoutFrame(d);
                }
                // draw label
                if (labelStr) {
                    const padding = 4;
                    const strokeWidth = 1;
                    const g = labels
                        .append("g")
                        .classed("labelgroup", true);
                    const rect = g
                        .append("rect")
                        .attr("fill", "white")
                        .attr("stroke", "black")
                        .attr("stroke-width", strokeWidth)
                    const text = g
                        .append("text")
                        .text(labelStr)
                        .attr("x", (+this.getAttribute("cx")) + (+this.getAttribute("r")) + padding)
                        .attr("y", (+this.getAttribute("cy")) - (+this.getAttribute("r")))
                    const bbox = text.node().getBBox();
                    rect
                        .attr("x", bbox.x - padding + strokeWidth)
                        .attr("y", bbox.y - (bbox.height * 1.2 - bbox.height) / 2)
                        .attr("width", bbox.width + 8)
                        .attr("height", bbox.height * 1.2)
                        .attr("rx", bbox.height * 0.2)
                        .attr("ry", bbox.height * 0.2)
                }
            }

        }

    }

    function drawLegend() {

        start(marker, {
            pending: showLoading,
            rejected: showError,
            fulfilled: draw
        });

        function showLoading() {
            console.log("loading");
        }

        function showError(error) {
            console.warn("error", error);
        }

        function draw() {

            const colorConfig = marker.encoding.get("color");
            const superHighlight = marker.encoding.get("superhighlighted");
            let data;

            if (isEntityConcept(colorConfig.data.conceptProps)) {
                // need extra query
                data = legendmarker.dataArray;
            } else {
                data = colorConfig.scale.domain.map(d => ({ color: d, name: d }));
            }

            const update = svg.selectAll(".legend")
                .data(data);
            const enter = update.enter().append("g")
                .attr("class", "legend");
            const exit = update.exit().remove();

            enter.append('text');
            enter.append('rect');

            const legend = svg.selectAll(".legend");

            legend.attr("transform", function(d, i) {
                return "translate(0," + i * 20 + ")";
            });

            legend.select("rect")
                .attr("x", appState.width - 18)
                .attr("width", 18)
                .attr("height", 18)
                .style("fill", d => colorConfig.d3Scale(d.color))
                .on("mouseover", d => {
                    const values = marker.dataArray.filter(d2 => d2["color"] == d["color"] && !d2[Symbol.for('trail')]);
                    superHighlight.data.filter.set(values);
                })
                .on("mouseout", d => {
                    const values = marker.dataArray.filter(d2 => d2["color"] == d["color"] && !d2[Symbol.for('trail')]);
                    superHighlight.data.filter.delete(values);
                });

            legend.select("text")
                .attr("x", appState.width - 24)
                .attr("y", 9)
                .attr("dy", ".35em")
                .style("text-anchor", "end")
                .text(function(d) {
                    return d.name;
                });
        }

    }

    function drawChart() {

        start(marker, {
            pending: showLoading,
            rejected: showError,
            fulfilled: draw
        });

        function showLoading() {
            console.log("loading");
        }

        function showError(error) {
            console.warn("error", error);
        }

        function draw() {
            const xConfig = marker.encoding.get("x");
            const yConfig = marker.encoding.get("y");

            chart.attr("width", appState.width + appState.margin.left + appState.margin.right)
                .attr("height", appState.height + appState.margin.top + appState.margin.bottom)
            svg.attr("transform", "translate(" + appState.margin.left + "," + appState.margin.top + ")");

            // var t = getTransition(frameConfig);

            xAxis.scale(zoomScales.x);
            yAxis.scale(zoomScales.y);
            xAxisSVG
                .attr("transform", "translate(0," + appState.height + ")")
                //.transition(t)
                .call(xAxis)
            xAxisSVGtext
                .attr("x", appState.width)
                .text(xConfig.data.conceptProps.name)
            yAxisSVG
            //.transition(t)
                .call(yAxis);
            yAxisSVGtext
                .text(yConfig.data.conceptProps.name)
        }
    };

    function getTransition(frameConfig) {
        return (!frameConfig) ? d3.transition() : d3.transition()
            .duration(frameConfig.speed)
            .ease(d3.easeLinear);
    }

    function drawEncoding() {

        draw();

        function showLoading() {
            console.log("loading");
        }

        function showError(error) {
            console.warn("error", error);
        }

        function draw() {

            spaceSel
                .on("change", function() {
                    const space = d3.select(this.options[this.selectedIndex]).datum();
                    marker.config.data.space = space;
                });

            const spaceOptUpd = spaceSel
                .selectAll('option')
                .data(marker.spaceAvailability);

            const spaceOptEnter = spaceOptUpd.enter()
                .append('option')
                .text(d => d.join(', '));

            spaceOptEnter.merge(spaceOptUpd)
                .property('selected', function(d) {
                    return arrayEquals(d, marker.data.space);
                });


            // create selects
            const encs = ["x", "y", "size", "color"];
            const divsUpdate = d3.select('#encodingcontrol')
                .selectAll('div')
                .data(encs);
            const divsEnter = divsUpdate
                .enter()
                .append('div');

            divsEnter
                .append('select')
                .attr('id', d => d + "select")
                .attr('class', 'encConceptSelect')
                .on("change", function(enc) {
                    const kv = d3.select(this.options[this.selectedIndex]).datum();
                    marker.encoding.get(enc).setWhich(kv);
                });
            divsEnter.insert("label", ":first-child").attr('for', d => d + "select").text(d => d);
            const divs = divsEnter.merge(divsUpdate);

            const extraDims = divsEnter.append('span').attr('id', d => d + 'dims').attr('class', "dims");
            divs.selectAll('.dims').each((prop, i, nodes) => {
                const div = nodes[i];
                const encoding = marker.encoding.get(prop);
                const encSpace = encoding.data.space;
                const dims = relativeComplement(marker.data.space, encSpace).map(dim => ({ dim, encoding }));
                const promises = dims.map(d => {
                    return d.encoding.data.source.query({
                        select: {
                            key: [d.dim],
                            value: ["name"]
                        },
                        from: "entities"
                    }).then(data => {
                        return { data, dim: d.dim }
                    });
                });
                Promise.all(promises).then(dims => {
                    const dimUpdate = d3.select(div).selectAll('span')
                        .data(dims);
                    const dimEnter = dimUpdate
                        .enter()
                        .append('span');
                    dimEnter
                        .append('label').attr('for', d => d.dim + "_extraDim").text(d => d.dim)
                    dimEnter
                        .append('select')
                        .attr('id', d => d.dim + "_extraDim")
                        .on("change", function(enc) {
                            const dim = d3.select(this).datum().dim;
                            const kv = d3.select(this.options[this.selectedIndex]).datum();
                            encoding.data.filter.config.dimensions[dim] = {
                                [dim]: kv[dim]
                            };
                        })
                        .selectAll('option')
                        .data(d => {
                            return d.data
                        })
                        .enter()
                        .append('option')
                        .text(d => d.name);
                    dimUpdate.exit().remove().each(function(d) {
                        const dim = d3.select(this).datum().dim;
                        encoding.data.filter.config.dimensions[dim] = {};
                    });
                });
            });
            // populate select options
            const items = marker.availability;

            const selects = divs.selectAll('select.encConceptSelect');
            const selUpdate = selects.selectAll("option").data(items);
            const selEnter = selUpdate.enter()
                .append('option');
            selEnter.merge(selUpdate)
                .attr('value', d => !d.value ? 'n/a' : d.value.concept + ' (' + d.key.join(',') + ')')
                .property('selected', function(d) {
                    const encId = d3.select(this.parentNode).datum();
                    const enc = marker.encoding.get(encId)
                    return d.value && d.value.concept == enc.data.concept && arrayEquals(d.key, enc.data.space);
                })
                .text(d => !d.value ? 'n/a' : d.value.name + ' (' + d.key.join(',') + ')')
                .sort((a, b) => !a.value || !b.value ? 0 : (a.value.name > b.value.name ? 1 : -1));
            const selExit = selUpdate.exit().remove();


        };
    }
};