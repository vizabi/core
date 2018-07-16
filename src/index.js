import { observable, autorun, action } from 'mobx'
import markerStore from './markerStore'
import appState from './appState'

chart();

function chart() {

    const config = appState;
    const marker = markerStore.get("bubbles");

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

    const updateSize = action(function(e) {
        var wrap = document.getElementById("wrapper");
        appState.size.height = wrap.clientHeight;
        appState.size.width = wrap.clientWidth;
    });
    window.addEventListener("resize", updateSize);
    updateSize();

    autorun(newData);
    autorun(redrawChart);

    function newData() {

        const data = marker.frameData;
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
        update.exit().remove();

        update.enter().append("circle")
            .attr("class", "dot")
            .style("fill", function(d) {
                return colorConfig.d3Scale(d.color); // fills color domain
            });

        var t = d3.transition()
            .duration(frameConfig.speed)
            .ease(d3.easeLinear);

        svg.selectAll(".dot")
            .transition(t)
            .attr("cx", function(d) {
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
            })

        var legend = svg.selectAll(".legend")
            .data(colorConfig.d3Scale.domain())
            .enter().append("g")
            .attr("class", "legend");

        legend.append("rect");
        legend.append("text");

    }

    function redrawChart() {

        const sizeConfig = marker.encoding.get("size");
        const colorConfig = marker.encoding.get("color");
        const xConfig = marker.encoding.get("x");
        const yConfig = marker.encoding.get("y");
        const frameConfig = marker.encoding.get("frame");

        chart.attr("width", config.width + margin.left + margin.right)
            .attr("height", config.height + margin.top + margin.bottom)
        svg.attr("transform", "translate(" + margin.left + "," + margin.top + ")");


        var t = d3.transition()
            .duration(frameConfig.speed)
            .ease(d3.easeLinear);

        xAxis.scale(xConfig.d3Scale);
        yAxis.scale(yConfig.d3Scale);
        xAxisSVG
            .attr("transform", "translate(0," + config.height + ")")
            .transition(t)
            .call(xAxis)
        xAxisSVGtext
            .attr("x", config.width)
            .text(xConfig.which)
        yAxisSVG
            .transition(t)
            .call(yAxis);
        yAxisSVGtext
            .text(yConfig.which)

        var legend = svg.selectAll(".legend")
            .attr("transform", function(d, i) {
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


    };

};