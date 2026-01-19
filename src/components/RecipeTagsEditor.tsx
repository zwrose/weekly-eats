"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Chip,
  TextField,
  Autocomplete,
  Typography,
  Button,
} from '@mui/material';
import { fetchUserTags } from '@/lib/recipe-user-data-utils';

interface RecipeTagsEditorProps {
  tags: string[];
  sharedTags?: string[];
  onChange?: (tags: string[]) => void;
  editable?: boolean;
  label?: string;
}

// Special marker for "Create new tag" option
const CREATE_NEW_TAG_MARKER = '__create_new_tag__';

export default function RecipeTagsEditor({
  tags,
  sharedTags = [],
  onChange,
  editable = true,
  label = 'Tags',
}: RecipeTagsEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch user's existing tags on mount
  useEffect(() => {
    if (editable) {
      fetchUserTags()
        .then((userTags) => {
          setAvailableTags(userTags);
        })
        .catch((error) => {
          console.error('Error fetching user tags:', error);
          // Continue with empty tags list if fetch fails
        });
    }
  }, [editable]);

  const handleTagsChange = (newTags: string[]) => {
    if (onChange) {
      onChange(newTags);
    }
  };

  // Check if input matches an existing tag
  const inputMatchesExistingTag = useMemo(() => {
    if (!inputValue.trim()) return false;
    const inputLower = inputValue.trim().toLowerCase();
    return availableTags.some((tag) => tag.toLowerCase() === inputLower);
  }, [inputValue, availableTags]);

  // Filter existing tags based on input
  const filteredTags = useMemo(() => {
    if (!inputValue.trim()) return [];
    const inputLower = inputValue.trim().toLowerCase();
    return availableTags.filter((tag) =>
      tag.toLowerCase().includes(inputLower)
    );
  }, [inputValue, availableTags]);

  // Show "Create new tag" option only if:
  // 1. There is input text
  // 2. The input doesn't match an existing tag
  const shouldShowCreateNewOption =
    inputValue.trim() && !inputMatchesExistingTag;

  // Create options list with "Create new tag" option at the end if needed
  const optionsWithCreateNew = shouldShowCreateNewOption
    ? [...filteredTags, CREATE_NEW_TAG_MARKER]
    : filteredTags;

  const allTags = [...new Set([...tags, ...sharedTags])];

  const isCreateNewOption = (option: string) => option === CREATE_NEW_TAG_MARKER;

  return (
    <Box>
      {editable ? (
        <Box>
          <Autocomplete
            multiple
            options={optionsWithCreateNew}
            value={tags}
            inputValue={inputValue}
            open={isOpen && inputValue.trim() ? isOpen : false}
            onOpen={() => {
              if (inputValue.trim()) {
                setIsOpen(true);
              }
            }}
            onClose={() => setIsOpen(false)}
            onInputChange={(_, newInputValue, reason) => {
              setInputValue(newInputValue);
              if (!newInputValue.trim()) {
                setIsOpen(false);
              }
            }}
            onChange={(_, newValue) => {
              // Handle the "Create new tag" option separately
              const stringValues = newValue.filter((v): v is string => {
                if (isCreateNewOption(v)) {
                  // Add the new tag from input value
                  const newTag = inputValue.trim();
                  if (newTag && !tags.includes(newTag)) {
                    handleTagsChange([...tags, newTag]);
                  }
                  return false; // Exclude the marker from the value array
                }
                return typeof v === 'string' && !isCreateNewOption(v);
              });
              handleTagsChange(stringValues);
              setInputValue('');
              setIsOpen(false);
            }}
            getOptionLabel={(option) => {
              if (isCreateNewOption(option)) {
                return `Add "${inputValue.trim()}" as a tag`;
              }
              return option;
            }}
            isOptionEqualToValue={(option, value) => {
              if (isCreateNewOption(option) || isCreateNewOption(value)) {
                return isCreateNewOption(option) === isCreateNewOption(value);
              }
              return option === value;
            }}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;

              // Special rendering for "Create new tag" option
              if (isCreateNewOption(option)) {
                return (
                  <Box
                    component="li"
                    key={key}
                    {...otherProps}
                    sx={{ p: '8px !important' }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newTag = inputValue.trim();
                        if (newTag && !tags.includes(newTag)) {
                          handleTagsChange([...tags, newTag]);
                        }
                        setInputValue('');
                        setIsOpen(false);
                      }}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                    >
                      Add &quot;{inputValue.trim()}&quot; as a tag
                    </Button>
                  </Box>
                );
              }

              // Regular tag option rendering
              return (
                <Box component="li" key={key} {...otherProps}>
                  <Typography variant="body1">{option}</Typography>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={label || undefined}
                placeholder="Type to search existing tags"
                size="small"
                fullWidth
                onKeyDown={(e) => {
                  // Override Enter key handling to prioritize existing tags
                  if (e.key === 'Enter') {
                    // If there are filtered existing tags, select the first one
                    if (filteredTags.length > 0) {
                      e.preventDefault();
                      const tagToAdd = filteredTags[0];
                      if (!tags.includes(tagToAdd)) {
                        handleTagsChange([...tags, tagToAdd]);
                      }
                      setInputValue('');
                      setIsOpen(false);
                      return;
                    }

                    // Only create new tag if no existing tags match
                    if (shouldShowCreateNewOption) {
                      e.preventDefault();
                      const newTag = inputValue.trim();
                      if (newTag && !tags.includes(newTag)) {
                        handleTagsChange([...tags, newTag]);
                      }
                      setInputValue('');
                      setIsOpen(false);
                      return;
                    }
                  }
                }}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  label={option}
                  size="small"
                  onDelete={editable ? () => {
                    handleTagsChange(tags.filter((tag) => tag !== option));
                  } : undefined}
                />
              ))
            }
            noOptionsText={
              inputValue.trim() ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    No tags found
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newTag = inputValue.trim();
                      if (newTag && !tags.includes(newTag)) {
                        handleTagsChange([...tags, newTag]);
                      }
                      setInputValue('');
                      setIsOpen(false);
                    }}
                  >
                    Add &quot;{inputValue.trim()}&quot; as a tag
                  </Button>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Start typing to search for tags
                </Typography>
              )
            }
            selectOnFocus
            clearOnBlur
            handleHomeEndKeys
          />
          {sharedTags.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Shared tags:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {sharedTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      ) : (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {label}
          </Typography>
          {tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  color="primary"
                  variant="filled"
                />
              ))}
            </Box>
          )}
          {sharedTags.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Shared tags:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {sharedTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
          {allTags.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No tags
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

