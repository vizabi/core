//https://stackoverflow.com/questions/11322651/how-to-avoid-log-zero-in-graph-using-d3-js/13228478#13228478

d3.scaleGenericLog = function() {
    return GenericLog();
};

function GenericLog() {
    var PROJECTION = [1, 10];
    var linearScale, logScale;

    linearScale = d3.scaleLinear();
    linearScale.range(PROJECTION);

    logScale = d3.scaleLog();
    logScale.domain(PROJECTION);

    function scale(x) {
        return logScale(linearScale(x));
    }
    scale.domain = function(x) {
        if (!arguments.length) return linearScale.domain();
        linearScale.domain(x);
        return scale;
    };
    scale.range = function(x) {
        if (!arguments.length) return logScale.range();
        logScale.range(x);
        return scale;
    };
    scale.ticks = function(m) {
        return linearScale.ticks(m);
    };
    return scale;

}