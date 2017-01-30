"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var stream_1 = require("stream");
var commentsRe = /^:.*\n/mg;
function isSupportedField(field) {
    switch (field) {
        case "event":
        case "data":
        case "id":
        case "retry":
            return true;
        default:
            return false;
    }
}
function getFieldValue(fields, name) {
    var matchingFields = fields.filter(function (_a) {
        var field = _a.field;
        return field === name;
    });
    if (matchingFields.length === 0) {
        return;
    }
    return matchingFields[matchingFields.length - 1].value;
}
var Parser = (function (_super) {
    __extends(Parser, _super);
    function Parser() {
        var _this = _super.call(this, { readableObjectMode: true }) || this;
        _this._buf = "";
        return _this;
    }
    Parser.prototype._transformBlock = function (block) {
        block = block.trim();
        if (block === "") {
            return [];
        }
        var groups = block.split("\n\n");
        return groups.map(function (group) {
            var lines = group.split("\n");
            var fields = lines.map(function (line) {
                var colonInd = line.indexOf(":");
                if (colonInd === -1) {
                    return { field: line, value: "" };
                }
                var field = line.slice(0, colonInd);
                var value = line.slice(colonInd + 1).trim();
                if (field === "retry") {
                    value = +value;
                }
                return { field: field, value: value };
            }).filter(function (_a) {
                var field = _a.field;
                return isSupportedField(field);
            });
            var data = fields.filter(function (_a) {
                var field = _a.field;
                return field === "data";
            }).map(function (_a) {
                var value = _a.value;
                return value;
            }).join("\n");
            var type = getFieldValue(fields, "event") || "message";
            var lastEventId = getFieldValue(fields, "id");
            var retry = getFieldValue(fields, "retry");
            var event = { data: data, type: type };
            if (lastEventId != null) {
                event.lastEventId = lastEventId;
            }
            if (retry != null && !isNaN(retry)) {
                event.retry = retry;
            }
            return event;
        });
    };
    Parser.prototype._transform = function (chunk, encoding, callback) {
        var _this = this;
        chunk = chunk.toString(encoding !== "buffer" ? encoding : "utf-8");
        var data = ("" + this._buf + chunk).replace(commentsRe, "");
        var lastEventBoundary = data.lastIndexOf("\n\n") + 1;
        if (lastEventBoundary === 0) {
            this._buf = data;
            return callback();
        }
        this._buf = data.slice(lastEventBoundary);
        var block = data.slice(0, lastEventBoundary);
        var events = this._transformBlock(block);
        events.forEach(function (event) {
            _this.push(event);
        });
        callback();
    };
    Parser.prototype._flush = function (callback) {
        var _this = this;
        var events = this._transformBlock(this._buf);
        this._buf = "";
        events.forEach(function (event) {
            _this.push(event);
        });
        callback();
    };
    return Parser;
}(stream_1.Transform));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Parser;
//# sourceMappingURL=eventstream.js.map