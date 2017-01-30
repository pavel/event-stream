import { Transform } from "stream"

const fieldRe = /^data.*\n\n?|^id.*\n\n?|^reply.*\n\n?|^event.*\n\n?/mg

function isSupportedField(field: string): boolean {
	switch (field) {
		case "event":
		case "data":
		case "id":
		case "retry":
			return true
		default:
			return false
	}
}

function getFieldValue(fields: any[], name: string) {
	const matchingFields = fields.filter(({ field }) => field === name)
	if (matchingFields.length === 0) {
		return
	}
	return matchingFields[matchingFields.length - 1].value
}

interface MessageEvent {
	type: string
	data: string
	lastEventId?: string
	retry?: number
}

class Parser extends Transform {

	private _buf: string = ""

	constructor() {
		super({ readableObjectMode: true })
	}

	private _transformBlock(block) {
		// Eliminates unsupported fields and comments
		block = block.match(fieldRe)
		if (block === null) {
			return []
		}
		const groups = block.join("").trim().split("\n\n")
		return groups.map((group): MessageEvent => {
			const lines: string[] = group.split("\n")
			const fields = lines.map((line) => {
				const colonInd = line.indexOf(":")
				if (colonInd === -1) {
					return { field: line, value: "" }
				}
				const field = line.slice(0, colonInd)
				let value: any = line.slice(colonInd + 1).trim()
				if (field === "retry") {
					value = +value
				}
				return { field, value }
			}).filter(({ field }) => {
				return isSupportedField(field)
			})
			const data = fields.filter(({ field }) => {
				return field === "data"
			}).map(({ value }) => value).join("\n")
			const type = getFieldValue(fields, "event") || "message"
			const lastEventId = getFieldValue(fields, "id")
			const retry = getFieldValue(fields, "retry")

			const event: MessageEvent = { data, type }
			if (lastEventId != null) {
				event.lastEventId = lastEventId
			}
			if (retry != null && !isNaN(retry)) {
				event.retry = retry
			}
			return event
		})
	}

	protected _transform(chunk: any, encoding: string, callback: Function): void {
		chunk = chunk.toString(encoding !== "buffer" ? encoding : "utf-8")
		const data = `${this._buf}${chunk}`
		const lastEventBoundary = data.lastIndexOf("\n\n") + 1
		if (lastEventBoundary === 0) {
			this._buf = data
			return callback()
		}
		this._buf = data.slice(lastEventBoundary)
		const block = data.slice(0, lastEventBoundary)
		const events = this._transformBlock(block)
		events.forEach((event) => {
			this.push(event)
		})
		callback()
	}

	protected _flush(callback: Function) {
		this._transform("", "utf-8", callback)
		this._buf = ""
	}

}

export default Parser
