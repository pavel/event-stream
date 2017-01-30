import * as assert from "assert"
import Parser from "../src/eventstream"

describe("event stream", () => {
	it("should work in a simple case", (done) => {
		const parser = new Parser()
		parser.on("data", ({ type, data }) => {
			assert.equal(type, "message")
			assert.equal(data, "some text")
		})
		parser.write("data: some text")
		parser.on("end", done)
		parser.end()
	})
	it("should parse all fields", (done) => {
		const parser = new Parser()
		parser.on("data", ({ type, data, lastEventId, retry }) => {
			assert.equal(type, "customEventType")
			assert.equal(data, "some text")
			assert.equal(lastEventId, "100")
			assert.equal(retry, 500)
		})
		parser.write("data: some text\n")
		parser.write("event: customEventType\n")
		parser.write("id: 100\n")
		parser.write("retry: 500")
		parser.on("end", done)
		parser.end()
	})
	it("should ignore invalid retry values", (done) => {
		const parser = new Parser()
		parser.on("data", ({ type, data, retry }) => {
			assert.equal(type, "message")
			assert.equal(data, "some text")
			assert.equal(retry, undefined)
		})
		parser.write("data: some text\n")
		parser.write("retry: abcd")
		parser.on("end", done)
		parser.end()
	})
	it("should strip non-standard fields", (done) => {
		const parser = new Parser()
		parser.on("data", (event) => {
			const keys = Object.keys(event)
			assert.deepEqual(keys, ["data", "type"])
		})
		parser.write("data: some text\n")
		parser.write("someNonStandardField: thisShouldBeIgnored")
		parser.on("end", done)
		parser.end()
	})
	it("should handle comments", (done) => {
		const data = [
			"data: some text",
			": comment"
		].join("\n")
		const parser = new Parser()
		parser.on("data", ({ type, data }) => {
			assert.equal(type, "message")
			assert.equal(data, "some text")
		})
		parser.write(data)
		parser.on("end", done)
		parser.end()
	})
	it("should handle chunked data", (done) => {
		const parser = new Parser()
		let eventCount = 0
		parser.on("data", ({ type, data }) => {
			eventCount++
			assert.equal(type, "message")
			assert.equal(data, "some text")
		})
		parser.write("data:")
		parser.write(" some text")
		parser.write("\n")
		parser.write("\nda")
		parser.write("ta: some text")
		parser.on("end", () => {
			assert.equal(eventCount, 2)
			done()
		})
		parser.end()
	})
	it("should handle field overwrites", (done) => {
		const parser = new Parser()
		parser.on("data", ({ type, data, lastEventId, retry }) => {
			assert.equal(type, "bar")
			assert.equal(data, "some text")
			assert.equal(lastEventId, "200")
			assert.equal(retry, 1500)
		})
		parser.write("data: some text\n")
		parser.write("event: foo\n")
		parser.write("event: bar\n")
		parser.write("id: 100\n")
		parser.write("id: 200\n")
		parser.write("retry: 500\n")
		parser.write("retry: 1500")
		parser.on("end", done)
		parser.end()
	})
	it("should handle multiline messages", (done) => {
		const parser = new Parser()
		parser.on("data", ({ type, data }) => {
			assert.equal(type, "message")
			assert.equal(data, "line1\nline2")
		})
		parser.write("data: line1\n")
		parser.write("data: line2")
		parser.on("end", done)
		parser.end()
	})
	it("should produce correct amount of events", (done) => {
		const parser = new Parser()
		let eventCount = 0
		parser.on("data", () => {
			eventCount++
		})
		parser.write("data: line1\n\n")
		parser.on("end", () => {
			assert.equal(eventCount, 1)
			done()
		})
		parser.end()
	})
	it("should handle long running tasks", (done) => {
		const parser = new Parser()
		let locked = false
		parser.once("data", () => {
			assert.equal(locked, false)
		})
		parser.write("data: line1\n")
		setTimeout(() => {
			parser.write("\n")
		}, 200)
		setTimeout(() => {
			locked = true
			parser.end()
		}, 500)
		parser.on("end", done)
	})
})
