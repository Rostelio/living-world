-- Builds a .aseprite file from numbered 16×16 frames and a tag list (name from to ms per line).
-- aseprite -b --script-param dir=<frames dir> --script-param out=<file.aseprite> --script tests/tools/build-aseprite.lua
local dir, out = app.params.dir, app.params.out
local spr = Sprite(16, 16, ColorMode.RGB)
spr.layers[1].name = "villager"
local i = 0
while app.fs.isFile(app.fs.joinPath(dir, "f" .. i .. ".png")) do
  if i > 0 then spr:newEmptyFrame() end
  local img = Image{ fromFile = app.fs.joinPath(dir, "f" .. i .. ".png") }
  spr:newCel(spr.layers[1], spr.frames[i + 1], img, Point(0, 0))
  i = i + 1
end
for line in io.lines(app.fs.joinPath(dir, "tags.txt")) do
  local name, from, to, ms = line:match("(%S+) (%d+) (%d+) (%d+)")
  if name then
    from, to, ms = tonumber(from), tonumber(to), tonumber(ms)
    local tag = spr:newTag(from + 1, to + 1)
    tag.name = name
    for f = from + 1, to + 1 do spr.frames[f].duration = ms / 1000 end
  end
end
spr:saveAs(out)
print("saved " .. out .. " with " .. i .. " frames")
