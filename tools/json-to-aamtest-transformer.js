#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const TEST_PATH_ROLE = path.resolve(__dirname, '..', 'aamtests', 'role');
const TEST_PATH_ATTR = path.resolve(__dirname, '..', 'aamtests', 'attr');

// Argument processing and "--help" construction
const argv = yargs(hideBin(process.argv))
      .usage('Transforms spec-extracted JSON to `aamtest` tests')
      .alias('v', 'verbose')
      .describe('v', 'verbose')
      .help('h')
      .alias('h', 'help')
      .argv;


// mappings.json create in https://github.com/w3c/aria/pull/2744
let JSONMapFile = path.resolve("./tools/mappings.json");

// testable-html.json is data that was pulled from Joanie's tests, then, hand modified
let HTMLMapFile = path.resolve("./tools/testable-html.json");

let map = JSON.parse(fs.readFileSync(JSONMapFile));
let htmlmap = JSON.parse(fs.readFileSync(HTMLMapFile));

let origrole = ["blockquote.py", "button.py", "button_haspopup.py", "button_pressed.py"];
let pr58654 = ["alert.py", "application.py", "article.py", "banner.py", "caption.py", "checkbox.py", "combobox.py", "complementary.py", "contentinfo.py", "definition.py", "deletion.py", "directory.py", "document.py", "emphasis.py", "feed.py", "figure.py", "generic.py", "group.py", "heading.py", "insertion.py", "list.py", "listitem.py", "main.py", "marquee.py", "menuitem.py", "menuitemcheckbox.py", "menuitemradio.py", "navigation.py", "note.py", "option.py", "paragraph.py", "radio.py", "radiogroup.py", "region.py", "row.py", "row_in_treegrid.py", "search.py", "sectionfooter.py", "sectionheader.py", "separator.py", "strong.py", "subscript.py", "superscript.py", "switch.py", "tabpanel.py", "term.py", "timer.py", "toolbar.py", "tooltip.py", "treeitem.py"];
let origattr = ["aria_autocomplete_inline_list_both.py", "aria_braillelabel.py", "aria_errormessage.py"];

let createdRoleTests = origrole.concat(pr58654);
let createdAttrTests = origattr;

function getCommentForItem(item) {
  if (item.type === 'not-mapped') {
    // When there is an astrix, we cannot test the mapping (user agent MAY map)
    if (item.description.indexOf("*") > 0) {
      return 'NOT MAPPED - skip';
    }
    return item.description;
  }
  if (item.type === 'not-in-tree' || item.type === "seealso") {
    return item.description;
  }

  // Special case for atspi:
  if (item.description && item.description.indexOf('SHOULD') > 0) {
    return undefined;
  }

  let comment = `${item.type}`;
  if (item.value) comment += `: ${item.value}`;
  if (item.description) comment += `: ${item.description.replace(/^: /, '').replace(/\n +/g, " ")}`;

  return comment;
}

function getAtspiScriptForItem(item, comment) {
  script = [];
  if (item.type === "not-mapped") {
    return [];
  }

  if (item.type === 'Role') {
    let role = item.value.replace(/^ROLE_/, '');
    script.push(`assert atspi.Accessible.get_role(node) == atspi.Role.${role}`);
  }

  else if (item.type === 'Object Attribute') {
    if (comment.indexOf("should contain the author-provided value.") > 0) {
      script.push(`assert "${item.value}:<value>" in atspi.Accessible.get_attributes_as_array(node)`);
    } else {
      script.push(`assert "${item.value}" in atspi.Accessible.get_attributes_as_array(node)`);
    }
  }

  else if (item.type === 'Method') {
    let func = item.value.replace(/\(\)/, '').replace(/atk_/, '').split(/_(.*)/s);
    let api = String(func[0]).charAt(0).toUpperCase() + String(func[0]).slice(1);
    script.push(`assert atspi.${api}.${func[1]}(node) == <value>`);
  }

  else if (item.type === 'State') {
    if (comment.indexOf("not exposed") > 0) {
      script.push(`assert "${item.value}" not in atspi.get_state_list_helper(node)`);
    }
    else {
      script.push(`assert "${item.value}" in atspi.get_state_list_helper(node)`);
    }
  }

  else if (item.type === 'Relation') {
    let relation = item.value; //item.value.replace(/^RELATION_/, '');
    script.push("relations = atspi.get_relations_dictionary_helper(node)");
    script.push(`assert '${relation}' in relations`);
    script.push(`assert '<relationID>' in relations['${relation}']`);
  }

  else if (item.type === 'Reverse Relation') {
    let relation = item.value; //.replace(/^RELATION_/, '');
    script.push("reverse_node = atspi.find_node('<relationID>', session.url)");
    script.push("reverse_relations = atspi.get_relations_dictionary_helper(reverse_node)");
    script.push(`assert '${relation}' in reverse_relations`);
    script.push(`assert 'test' in reverse_relations['${relation}']`);

  }

  else if (item.type === 'Text Attribute') {
    // Not sure if should use:
    // - getInterface(Text).getAttribute(${attribute})
    // - getInterface(Text).get_run_attributes
    let keyValue = item.value.split(":");
    script.push(`atspi.Text.getAttribute(${keyValue[0]}) == ${keyValue[1]}`);

  }

  // TODO: fix: image_tentative.py
  else if (item.type === 'Interface') {

    // TODO: maybe create a helper function for each interface?
    if (item.value === 'Table') {
      script.push(`assert atspi.Accessible.get_table_iface(node) is not None`);
    }
    if (item.value === 'TableCell') {
      script.push(`assert atspi.Accessible.get_table_cell(node) is not None`);
    }
    if (item.value === 'EditableText') {
      script.push(`assert atspi.Accessible.get_editable_text_iface(node) is not None`);
    }
    if (item.value === 'Selection') {
      script.push(`assert atspi.Accessible.get_selection_iface(node) is not None`);
    }
    if (item.value === 'Value') {
      script.push(`assert atspi.Accessible.get_value_iface(node) is not None`);
    }
    if (item.value === 'HyperLink' || item.value === 'HyperlinkImpl') {
      script.push(`assert atspi.Accessible.get_hypertext_iface(node) is not None`);
    }
    if (item.value === 'Image') {
      script.push(`assert atspi.Accessible.get_image_iface(node) is not None`);
    }
  }

  else if (item.type === 'Name' || item.value === 'Name') {
    script.push(`assert atspi.Accessible.get_name(node) == <value>`)
  }
  else if (item.type === 'Description' || item.value == 'Description') {
    script.push(`assert atspi.Accessible.get_description(node) == <value>`)
  }
  else if (item.type === 'not-in-tree') {
    script.push(`assert not node`)
  }

  else {
    console.log(`No script for comment: \n\t${comment}`);
  }

  return script;

}


function getAtspiScriptAndComments(mappings, htmlData) {
  let comments = [];
  let script = [];
  for (item of mappings.items) {
    comment = getCommentForItem(item);
    if (comment === "NOT MAPPED - skip") return [[], []];
    if (comment !== undefined && item.type !== "seealso") {
      comments.push(comment);
      new_script_lines = getAtspiScriptForItem(item, comment);
      if (htmlData.value || htmlData.relationID) {
        for (let i = 0; i < new_script_lines.length; i++) {
          new_script_lines[i] = new_script_lines[i].replace('<value>', htmlData.value);
          new_script_lines[i] = new_script_lines[i].replace('<relationID>', htmlData.relationID);
        }
      }

      script = script.concat(new_script_lines);
    }
  }

  if (mappings.note) {
    comments.push(mappings.note.replace(/\n +/g, " "));
  }

  return [comments, script];
}

function getComments(mappings) {
  let comments = [];
  for (item of mappings.items) {
    comment = getCommentForItem(item);
    if (comment === "NOT MAPPED - skip") return [];
    if (comment !== undefined) {
      comments.push(comment);
    }
  }

  if (mappings.note) {
    comments.push(mappings.note.replace(/\n +/g, " "));
  }
  return comments;
}



function renderAtspiTest(comments, script) {
  return `
def test_atspi(atspi, session, inline):
    session.url = inline(TEST_HTML)

    # Spec:
    # ${comments.join("\n    # ")}

    node = atspi.find_node("test", session.url)
    ${script.join("\n    ")}
`
}

function renderIncompleteTest(api, comments) {
  return `
# def test_${api}(${api}, session, inline):
#     session.url = inline(TEST_HTML)
#
#     # Spec:
#     # ${comments.join("\n#     # ")}
`
}

function renderNotMapped(api) {
return `
# Intentionally no ${api} test. ${api} does not surface this node or attribute.
`
}


function renderTest(script, idfrag, html) {
  return `# Testing: https://w3c.github.io/core-aam/#${idfrag}

TEST_HTML = "${html}"
${script}`;
}

function createTest(urlfrag, table, htmlkey) {
  let [atspiComments, atspiScript] = getAtspiScriptAndComments(table.atkAtSpi, htmlmap[htmlkey]);

  let axapiComments = getComments(table.axApi);
  let ia2Comments = getComments(table.msaaIA2);
  let uiaComments = getComments(table.uia);

  // Not mapped
  if (atspiComments.length === 0 && axapiComments.length === 0 && ia2Comments.length === 0 && uiaComments.length === 0) {
    return undefined
  }

  if (atspiScript.length === 0 && htmlmap[htmlkey].atspi) {
    atspiScript = htmlmap[htmlkey].atspi;
  }

  let script = '';
  script += (atspiComments.length === 0) ?
    renderNotMapped('ATSPI') :
    renderAtspiTest(atspiComments, atspiScript);

  script += (axapiComments.length === 0) ?
    renderNotMapped('AX API') :
    renderIncompleteTest('axapi', axapiComments);

  script += (ia2Comments.length === 0) ?
    renderNotMapped('IA2') :
    renderIncompleteTest('ia2', ia2Comments);

  script += (uiaComments.length === 0) ?
    renderNotMapped('UIA') :
    renderIncompleteTest('uia', uiaComments);

  return renderTest(script, urlfrag, htmlmap[htmlkey].html);
}

// Main

Object.keys(map.roles).forEach(function (urlfrag) {
  // Skipping for now, might just need changes, might not be possible to test
  if (["role-map-form-nameless", "role-map-none", "role-map-presentation", "role-map-region-nameless"].includes(urlfrag)) {
    return;
  }

  let newTestFile = urlfrag.replace(/^role-map-/, '').replaceAll('-', '_') + ".py";
  if (createdRoleTests.includes(newTestFile)) {
    return;
  }

  // Cannot have a test file named code.py or math.py
  if (newTestFile == "code.py") {
    newTestFile = "code-role.py"
  }
  if (newTestFile == "math.py") {
    newTestFile = "math-role.py"
  }
  if (newTestFile == "time.py") {
    newTestFile = "time-role.py"
  }



  htmlkey = urlfrag.replace(/^role-map-/, '');
  let test = createTest(urlfrag, map.roles[urlfrag], htmlkey)
  if (!test) {
    console.log(`==> skipping: ${urlfrag}`)
    return;
  }

  const newTestFilePath = path.resolve(TEST_PATH_ROLE, newTestFile);
  fs.writeFileSync(newTestFilePath, test);
  console.log(`------------------------- ${newTestFile}`);
  console.log(test);
})

Object.keys(map.attributes).forEach(function (urlfrag) {
  // Skipping for now, might just need changes, might not be possible to test
  if (["ariaActiveDescendant", "ariaDropeffectNone", "ariaDropeffectMoveLinkExecutePopup", "ariaAtomicTrue", "ariaHiddenTrue", "ariaHiddenTrueElementExposed", "ariaOwns", "ariaPlaceholder"].includes(urlfrag)) {
    return;
  }

  let newTestFile = urlfrag.replace(/(?<!^)(?=[A-Z])/g, '_').toLowerCase()  + ".py";
  if (createdAttrTests.includes(newTestFile)) {
    return;
  }

  let test = createTest(urlfrag, map.attributes[urlfrag], urlfrag)
  if (!test) {
    console.log(`==> skipping: ${urlfrag}`)
    return;
  }


  const newTestFilePath = path.resolve(TEST_PATH_ATTR, newTestFile);
  fs.writeFileSync(newTestFilePath, test);
  console.log(`------------------------- ${newTestFile}`);
  console.log(test);
})


// let manualTestsStillNeeded = Object.keys(htmlmap).filter(key => !htmlmap[key]["done"]);
// for (let k of manualTestsStillNeeded) {
//   console.log(k + "_manual.html");
// }


