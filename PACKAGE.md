Publishing New Releases
=======================

First, update the version number throughout the repo and add the tag:

    ./version.sh X.Y.Z

Verify things have gone well and then push the change and tag:

    git commit -a -m "Update version"
    git push

    git tag X.Y.Z
    git push origin X.Y.Z

GitHub CI Actions are used to automatically build a draft package whenever a tag is pushed to repo.

This will generate a draft release with a bulleted-list of ``git`` changes.
Edit the list and title as desired, then use the ``Publish`` button on the web interface to publish the release
