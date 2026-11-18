import { Effect, Layer } from "effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"

/** A stubbed Doppler HTTP API for tests. Not exported from the package. */
export const stubDoppler = (
  respond: (name: string) => { readonly status: number; readonly body: unknown }
) => {
  const requests: Array<{ readonly url: string; readonly authorization: string | undefined }> = []
  const layer = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      requests.push({ url: url.href, authorization: request.headers["authorization"] })
      const { body, status } = respond(url.searchParams.get("name") ?? "")
      return Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
        )
      )
    })
  )
  return { layer, requests }
}

export const secretBody = (name: string, value: string) => ({
  success: true,
  name,
  value: { raw: value, computed: value }
})
