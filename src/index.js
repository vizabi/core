import { autorun, action, spy } from 'mobx'
import { vizabi } from './vizabi'
import { config } from './config'
import appState from './appState'

var ddfcsv = new DDFCsvReader.getDDFCsvReaderObject();
var waffle = new WsReader.WsReader.getReader();
vizabi.stores.dataSource.createAndAddType('ddfcsv', ddfcsv);
vizabi.stores.dataSource.createAndAddType('waffle', waffle);
window.viz = vizabi(config);
window.vizabi = vizabi;
window.autorun = autorun;


spy((event) => {
    console.log(`${event.name}`, event)
})

//autorun(chart);
chart();

function chart() {

    const config = appState;
    const marker = viz.stores.marker.get("bubble");

    var margin = config.margin;

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

    function start({ fulfilled, rejected, pending }) {
        marker.availabilityPromise.case({
            fulfilled: () => {
                marker.conceptsPromise.case({
                    fulfilled: () => {
                        marker.dataPromise.case({
                            fulfilled,
                            rejected,
                            pending
                        })
                    }
                })
            }
        })
    }

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

    function drawTimecontrol() {

        start({
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
        start({
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
            const data = marker.data;
            const sizeConfig = marker.encoding.get("size");
            const colorConfig = marker.encoding.get("color");
            const xConfig = marker.encoding.get("x");
            const yConfig = marker.encoding.get("y");
            const frameConfig = marker.encoding.get("frame");
            const selectedConfig = marker.encoding.get("selected");
            const highlightConfig = marker.encoding.get("highlighted");
            const superHighlight = marker.encoding.get("superhighlighted");

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
                .on("mouseover", d => highlightConfig.set(d))
                .on("mouseout", d => highlightConfig.delete(d));

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
                        return xConfig.d3Scale(d.x);
                    })
                    .attr("cy", function(d) {
                        return yConfig.d3Scale(d.y);
                    })
                    .style("fill", function(d) {
                        return colorConfig.d3Scale(d.color);
                    })
                    .style('animation', d => {
                        return superHighlight.has(d) ?
                            'blink 1s step-start 0s infinite' :
                            'none';
                    })
                    .style('zIndex', d => isHighlightedTrail(d) ? 100 : 'auto')
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
                const highlighted = highlightConfig.has(d);
                const selected = selectedConfig.has(d);
                const trail = d[Symbol.for('trailHeadKey')];

                if (highlighted || selected) return full;
                if (trail) return regular;
                if (selectedConfig.any) return selectOthers;
                if (highlightConfig.any) return highlightOthers;
                return regular;
            }

            function isHighlightedTrail(d) {
                const key = d[Symbol.for('trailHeadKey')] || d[Symbol.for('key')];
                return selectedConfig.has(key) && highlightConfig.has(d)
            }

            function drawLabel(d) {
                let labelStr;
                // if trail, put label at trail start
                const key = d[Symbol.for('trailHeadKey')] || d[Symbol.for('key')];
                if (frameConfig.trails.has(key)) {
                    const trailStart = frameConfig.trails.getPayload(key);
                    // if this bubble is trail start bubble
                    if (trailStart == d[frameConfig.data.concept])
                        labelStr = marker.space.map(dim => d.label[dim]).join(', ');
                }
                /*
                if (selectedConfig.has(d)) {
                    labelStr = marker.space.map(dim => d.label[dim]).join(', ');
                }
                */
                // if highlight, put on highlight =)
                else if (highlightConfig.has(d)) {
                    labelStr = marker.space.filter(dim => frameConfig.data.concept != dim).map(dim => d.label[dim]).join(', ');
                }
                // draw label
                if (labelStr) {
                    const padding = 4;
                    const strokeWidth = 1;
                    const rect = labels
                        .append("rect")
                        .attr("fill", "white")
                        .attr("stroke", "black")
                        .attr("stroke-width", strokeWidth)
                    const text = labels
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
        start({
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

            const update = svg.selectAll(".legend")
                .data(colorConfig.d3Scale.domain());
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
                .attr("x", config.width - 18)
                .attr("width", 18)
                .attr("height", 18)
                .style("fill", colorConfig.d3Scale)
                .on("mouseover", d => {
                    const values = marker.data.filter(d2 => d2["color"] == d && !d2[Symbol.for('trail')]);
                    superHighlight.set(values);
                })
                .on("mouseout", d => {
                    const values = marker.data.filter(d2 => d2["color"] == d && !d2[Symbol.for('trail')]);
                    superHighlight.delete(values);
                });;

            legend.select("text")
                .attr("x", config.width - 24)
                .attr("y", 9)
                .attr("dy", ".35em")
                .style("text-anchor", "end")
                .text(function(d) {
                    return d;
                });
        }
    }

    function drawChart() {

        start({
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

            chart.attr("width", config.width + margin.left + margin.right)
                .attr("height", config.height + margin.top + margin.bottom)
            svg.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // var t = getTransition(frameConfig);

            xAxis.scale(xConfig.d3Scale);
            yAxis.scale(yConfig.d3Scale);
            xAxisSVG
                .attr("transform", "translate(0," + config.height + ")")
                //.transition(t)
                .call(xAxis)
            xAxisSVGtext
                .attr("x", config.width)
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

        start({
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

            // create selects
            const encs = ["x", "y", "size", "color"];
            const divs = d3.select('#encodingcontrol')
                .selectAll('div')
                .data(encs)
                .enter()
                .append('div');
            const selects = divs
                .append('select')
                .attr('id', d => d + "select")
                .on("change", function(enc) {
                    const kv = d3.select(this.options[this.selectedIndex]).datum();
                    marker.encoding.get(enc).setWhich(kv);
                });
            divs.insert("label", ":first-child").attr('for', d => d + "select").text(d => d);

            // populate select options
            const items = marker.availability;
            const selUpdate = selects.selectAll("option")
                .data(items);
            const selEnter = selUpdate.enter()
                .append('option')
                .attr('value', d => d.value.concept + ' (' + d.key.join(',') + ')')
                .property('selected', function(d) {
                    const encId = d3.select(this.parentNode).datum();
                    const enc = marker.encoding.get(encId)
                    return d.value.concept == enc.data.concept;
                })
                .text(d => d.value.name + ' (' + d.key.join(',') + ')');
            const selExit = selUpdate.exit().remove();
        };
    }
};