import { autorun, action, spy } from 'mobx'
import markerStore from './marker/markerStore'
import appState from './appState'
import * as d3 from 'd3'

chart();

function chart() {

    const config = appState;
    const marker = markerStore.get("bubble");

    var margin = config.margin;

    var xAxis = d3.axisBottom();
    var yAxis = d3.axisLeft();

    var chart = d3.select("#chart");
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

    //marker.encoding.get("frame").playing = true;

    function drawBubbles() {

        const data = marker.data;
        const sizeConfig = marker.encoding.get("size");
        const colorConfig = marker.encoding.get("color");
        const xConfig = marker.encoding.get("x");
        const yConfig = marker.encoding.get("y");
        const frameConfig = marker.encoding.get("frame");

        const update = svg.selectAll(".dot")
            .data(
                data,
                d => d[Symbol.for('key')]
            );

        const updateTransition = (frameConfig && frameConfig.playing) ?
            update.transition(getTransition(frameConfig)) :
            update.interrupt();

        [
            updateTransition,
            update.enter().append("circle")
            .attr("class", "dot")
            .attr("id", d => d[Symbol.for('key')])
        ].map(selection => {
            selection.attr("cx", function(d) {
                    return xConfig.d3Scale(d.x);
                })
                .attr("cy", function(d) {
                    return yConfig.d3Scale(d.y);
                })
                .style("fill", function(d) {
                    return colorConfig.d3Scale(d.color);
                })
                .attr("r", d => {
                    const which = sizeConfig.which;
                    const radius = isNaN(which) ? sizeConfig.d3Scale(d.size) : which;
                    return radius;
                });
        })

        update.exit().remove();
    }

    function drawLegend() {

        const colorConfig = marker.encoding.get("color");

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
            .style("fill", colorConfig.d3Scale);

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

        const sizeConfig = marker.encoding.get("size");
        const colorConfig = marker.encoding.get("color");
        const xConfig = marker.encoding.get("x");
        const yConfig = marker.encoding.get("y");
        const frameConfig = marker.encoding.get("frame");

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