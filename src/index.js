import { autorun, action, spy } from 'mobx'
import { vizabi } from './vizabi'
import { config } from './config'
import appState from './appState'
import * as d3 from 'd3'

var ddfcsv = new DDFCsvReader.getDDFCsvReaderObject();
vizabi.dataSourceStore.createAndAddType('ddfcsv', ddfcsv);
window.viz = vizabi(config);
window.vizabi = vizabi;
window.autorun = autorun;



//autorun(chart);
chart();

function chart() {

    const config = appState;
    const marker = viz.markerStore.get("bubble");

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

    const updateSize = action("wrapper size", function(e) {
        var wrap = document.getElementById("wrapper");
        appState.wrapper.height = wrap.clientHeight;
        appState.wrapper.width = wrap.clientWidth;
    });
    window.addEventListener("resize", updateSize);
    updateSize();

    autorun(drawBubbles);
    autorun(drawChart);
    autorun(drawLegend);
    //drawBubbles();
    //drawChart();
    //drawLegend();

    function drawBubbles() {

        const data = marker.data;
        if (data == null) { console.log('loading'); return; }
        const sizeConfig = marker.encoding.get("size");
        const colorConfig = marker.encoding.get("color");
        const xConfig = marker.encoding.get("x");
        const yConfig = marker.encoding.get("y");
        const frameConfig = marker.encoding.get("frame");
        const selectedConfig = marker.encoding.get("selected");
        const highlightConfig = marker.encoding.get("highlighted");
        const superHighlight = marker.encoding.get("superhighlighted");

        // data join
        let update = svg.selectAll(".dot")
            .data(
                data,
                d => d[Symbol.for('key')]
            );

        // create new bubbles
        const enter = update.enter()
            .append("circle")
            .attr("class", "dot")
            .attr("id", d => d[Symbol.for('key')])
            .on("click", selectedConfig.toggleSelection.bind(selectedConfig))
            .on("mouseover", highlightConfig.addSelection.bind(highlightConfig))
            .on("mouseout", highlightConfig.removeSelection.bind(highlightConfig));

        // remove old bubbles
        const exit = update.exit().remove();

        // create or stop transition of update selection
        update = (frameConfig && frameConfig.playing) ?
            update.transition(getTransition(frameConfig)) :
            update.interrupt();

        // update bubble properties
        // can't use merge as you can't merge transitions and selections without losing transition
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
                    return superHighlight.isSelected(d) ?
                        'blink 1s step-start 0s infinite' :
                        'none';
                })
                .style('stroke', 'black')
                .style('opacity', d => {
                    const highlight = 0.3;
                    const select = 0.5;
                    const other = 1;
                    const highlighted = highlightConfig.isSelected(d);
                    const selected = selectedConfig.isSelected(d);
                    const trail = d[Symbol.for('trail')] === true;

                    if (highlighted || selected || trail) return other;
                    if (selectedConfig.anySelected) return select;
                    if (highlightConfig.anySelected) return highlight;
                    return other;
                })
                .attr("r", d => {
                    const which = sizeConfig.which;
                    const radius = isNaN(which) ? sizeConfig.d3Scale(d.size) : which;
                    return radius;
                });

        })

        // sort bubbles        
        // why not just data.sort()? 
        // Because when d3-joining the data, data is split in two: enter and update.
        // Enter selection elements are always appended before update selection (which was already in DOM), regardless of data sorting
        // https://github.com/d3/d3-selection#selection_append
        // could sort data in marker, then use indexes for sorting bubbles, but d3.selection.sort() needed.
        const orderBy = "size";
        const orderTrailBy = frameConfig.which; // doesn't work if frame.which is value instead of key (then it's a.frame/b.frame)
        enter.merge(update).sort((a, b) => {
            const [aTrail, bTrail] = [a, b].map(d => typeof d[Symbol.for('trailHeadKey')] !== "undefined");

            // both trail or normal
            if (!aTrail && !bTrail) return b[orderBy] - a[orderBy] // sort normal bubbles
            if (aTrail && bTrail) return a[orderTrailBy] - b[orderTrailBy]; // sort trail bubbles

            // trail vs normal
            const [trail, normal] = bTrail ? [b, a] : [a, b]; // identify which is trail (one must be)
            if (normal[Symbol.for('key')] == trail[Symbol.for('trailHeadKey')]) return aTrail ? -1 : 1; // sort head of trail and trail (head of trail wins)
            return aTrail ? 1 : -1; // sort normal bubbles and trail (trail wins)
        })

    }

    function drawLegend() {

        if (marker.data == null) return;
        const colorConfig = marker.encoding.get("color");
        const superHighlight = marker.encoding.get("superhighlighted");

        const legendEntered = svg.selectAll(".legend")
            .data(colorConfig.d3Scale.domain())
            .enter().append("g")
            .attr("class", "legend");

        legendEntered.append('text');
        legendEntered.append('rect');

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
                superHighlight.addSelection(values);
            })
            .on("mouseout", d => {
                const values = marker.data.filter(d2 => d2["color"] == d && !d2[Symbol.for('trail')]);
                superHighlight.removeSelection(values);
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

    function drawChart() {

        if (marker.data == null) return;

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
            .text(xConfig.which)
        yAxisSVG
        //.transition(t)
            .call(yAxis);
        yAxisSVGtext
            .text(yConfig.which)


    };

    function getTransition(frameConfig) {
        return (!frameConfig) ? d3.transition() : d3.transition()
            .duration(frameConfig.speed)
            .ease(d3.easeLinear);
    }

};