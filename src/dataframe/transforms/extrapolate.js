import { assign, pickGetters, relativeComplement } from "../../core/utils";

export function extrapolateGroup(group, options) {
    const { fields, sizeLimit, indexLimit } = options;
    const frameKeys = [...group.keys()];
    // limits extrapolation to certain range, used by frame to limit to future filterRequired result
    const [firstIndex, lastIndex] = indexLimit ?? [0, frameKeys.length - 1]; 


    const groupFields = group.values().next().value.fields;
    const copyFields = relativeComplement(fields, groupFields);
    copyFields.push(Symbol.for('key'));
    copyFields.push(...group.key);

    function copyOrCreate(frame, markerKey, sourceMarker) {
        let extraMarker = frame.getByStr(markerKey);
        if (extraMarker !== undefined) {
            if (!(Symbol.for('extrapolated') in extraMarker)) {
                extraMarker = assign({}, extraMarker);
                extraMarker[Symbol.for('extrapolated')] = {}
                frame.setByStr(markerKey, extraMarker);
            }
        } else {
            extraMarker = pickGetters(sourceMarker, copyFields);
            extraMarker[Symbol.for('extrapolated')] = {}
            frame.setByStr(markerKey, extraMarker);
        }
        return extraMarker;
    }

    const newGroup = group.copy();

    for (const field of fields) {
        const lastIndices = new Map();
        for (let idx = firstIndex; idx < lastIndex + 1; idx++) {
            const frameKey = frameKeys[idx];
            const frame = newGroup.get(frameKey);
            for (const markerKey of frame.keys()) {
                const marker = frame.getByStr(markerKey);
                if (marker[field] != null) {
                    if (!lastIndices.has(markerKey) && idx > 0) {
                        // first occurence, extrapolate backwards
                        const fromIdx = Math.max(firstIndex, idx - sizeLimit);
                        const rows = getRows(newGroup, fromIdx, idx, frameKeys);
                        doExtrapolate(rows, marker, field, copyOrCreate);
                    }
                    // keep track of last occurence
                    lastIndices.set(markerKey, idx);
                }
            }
        }
        for (const markerKey of lastIndices.keys()) {
            const lastSeenIndex = lastIndices.get(markerKey);
            if (lastSeenIndex === lastIndex)
                continue;
            const sourceFrame = newGroup.get(frameKeys[lastSeenIndex]);
            const fromIdx = Math.min(lastIndex + 1, lastSeenIndex + 1);
            const toIdx = Math.min(lastIndex + 1, fromIdx + sizeLimit);
            const rows = getRows(newGroup, fromIdx, toIdx, frameKeys);
            const sourceMarker = sourceFrame.getByStr(markerKey)
            doExtrapolate(rows, sourceMarker, field, copyOrCreate);
        }
    }

    return newGroup;
}

function getRows(group, fromIdx, toIdx, frameKeys) {
    const rows = [];
    for (let i = fromIdx; i < toIdx; i++) {
        rows.push(group.get(frameKeys[i]));
    }
    return rows;
}

function doExtrapolate(rows, sourceMarker, field, copyOrCreate) {
    const markerKey = sourceMarker[Symbol.for('key')];
    for (const extraMember of rows) {
        const extraMarker = copyOrCreate(extraMember, markerKey, sourceMarker);
        extraMarker[field] = sourceMarker[field];
        extraMarker[Symbol.for('extrapolated')][field] = sourceMarker;
    }
}
