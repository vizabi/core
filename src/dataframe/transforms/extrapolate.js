import { assign, pickGetters, relativeComplement } from "../../core/utils";

export function extrapolateGroup(group, options) {
    const { fields = group.fields, sizeLimit, indexLimit, ammendNewRow = r => r } = options;
    const frameKeys = [...group.keys()];
    // limits extrapolation to certain range, used by frame to limit to future filterRequired result
    const [firstIndex, lastIndex] = indexLimit ?? [0, frameKeys.length - 1]; 

    const groupFields = group.values().next().value.fields;
    const copyFields = relativeComplement(fields, groupFields);
    copyFields.push(Symbol.for('key'));

    function copyOrCreate(member, rowKey, sourceMarker) {
        let extraRow = member.getByStr(rowKey);
        if (extraRow !== undefined) {
            if (!(Symbol.for('extrapolated') in extraRow)) { 
                // not yet copied, so copy
                extraRow = assign({}, extraRow); 
                extraRow[Symbol.for('extrapolated')] = {}
                member.setByStr(rowKey, extraRow);
            }
        } else {
            extraRow = Object.assign(pickGetters(sourceMarker, copyFields), group.keyObject(member));
            ammendNewRow(extraRow);
            extraRow[Symbol.for('extrapolated')] = {}
            member.setByStr(rowKey, extraRow);
        }
        return extraRow;
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
                        const frames = getFrames(newGroup, fromIdx, idx, frameKeys);
                        doExtrapolate(frames, marker, field, copyOrCreate);
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
            const frames = getFrames(newGroup, fromIdx, toIdx, frameKeys);
            const sourceMarker = sourceFrame.getByStr(markerKey)
            doExtrapolate(frames, sourceMarker, field, copyOrCreate);
        }
    }

    return newGroup;
}

function getFrames(group, fromIdx, toIdx, frameKeys) {
    const frames = [];
    for (let i = fromIdx; i < toIdx; i++) {
        frames.push(group.get(frameKeys[i]));
    }
    return frames;
}

function doExtrapolate(frames, sourceMarker, field, copyOrCreate) {
    const markerKey = sourceMarker[Symbol.for('key')];
    for (const extraMember of frames) {
        const extraMarker = copyOrCreate(extraMember, markerKey, sourceMarker);
        extraMarker[field] = sourceMarker[field];
        extraMarker[Symbol.for('extrapolated')][field] = sourceMarker;
    }
}
